import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Module, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomOrderStatus, OrderStatus, Prisma, ShopStatus } from '@prisma/client';

import { type AuthUser, CurrentUser, Public, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { newOrderNumber } from '../orders/checkout.service.js';
import { PaymentsService } from '../payments/payment-providers.js';
import { ProductRules } from '../seller/product-rules.js';
import { SellerContext } from '../seller/seller-shop.js';
import { SettingsService } from '../settings/settings.service.js';
import { AddressesService } from '../shopping/shopping.controllers.js';
import { ShoppingModule } from '../shopping/shopping.module.js';
import { UploadsService } from '../storage/uploads.js';
import {
  AcceptQuoteDto,
  CreateCustomOrderDto,
  CustomOrderQueryDto,
  MessageDto,
  QuoteDto,
  ReasonDto,
  SaveDesignDto,
} from './custom-orders.dto.js';

const OPEN: CustomOrderStatus[] = [CustomOrderStatus.REQUESTED, CustomOrderStatus.CLARIFICATION_NEEDED, CustomOrderStatus.QUOTED];
const DAY = 24 * 3600 * 1000;

const badState = (msg: string) => new AppException('REQUEST_STATE', msg, HttpStatus.CONFLICT);

@Injectable()
export class DesignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly rules: ProductRules,
  ) {}

  /** Validates the design and resolves its image upload to a URL the shops can see. */
  async normalise(userId: string, dto: SaveDesignDto) {
    await this.rules.assertAllowedIn('name', dto.name, dto.design.text);
    const { imageUploadId, ...rest } = dto.design;
    const [image] = await this.uploads.ownedUploads(userId, imageUploadId ? [imageUploadId] : [], 'design_asset');
    return { ...rest, text: rest.text || null, imageUploadId: image?.id ?? null, imageUrl: image?.url ?? null } satisfies Prisma.InputJsonValue;
  }

  list(userId: string) {
    return this.prisma.customDesign.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, design: true, updatedAt: true } });
  }

  async get(userId: string, id: string) {
    const d = await this.prisma.customDesign.findFirst({ where: { id, userId }, select: { id: true, name: true, design: true, updatedAt: true } });
    if (!d) throw Errors.notFound('Design');
    return d;
  }

  async create(userId: string, dto: SaveDesignDto) {
    if ((await this.prisma.customDesign.count({ where: { userId } })) >= 50) {
      throw new AppException('DESIGN_LIMIT', 'You can save up to 50 designs. Delete one to save another.');
    }
    const d = await this.prisma.customDesign.create({ data: { userId, name: dto.name, design: await this.normalise(userId, dto) } });
    return this.get(userId, d.id);
  }

  async update(userId: string, id: string, dto: SaveDesignDto) {
    await this.get(userId, id);
    await this.prisma.customDesign.update({ where: { id }, data: { name: dto.name, design: await this.normalise(userId, dto) } });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.customDesign.delete({ where: { id } });
    return { deleted: true };
  }
}

const requestInclude = {
  shop: { select: { id: true, name: true, slug: true, city: true, phone: true } },
  user: { select: { id: true, fullName: true } },
  order: { select: { orderNumber: true, status: true } },
  messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, body: true, createdAt: true, author: { select: { fullName: true } } } },
} satisfies Prisma.CustomOrderRequestInclude;

type RequestRow = Prisma.CustomOrderRequestGetPayload<{ include: typeof requestInclude }>;

function toRequest(r: RequestRow) {
  const expired = r.status === CustomOrderStatus.QUOTED && r.quoteValidUntil !== null && r.quoteValidUntil < new Date();
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    quoteExpired: expired,
    designName: r.designName,
    design: r.designSnapshot,
    quantity: r.quantity,
    requirements: r.requirements,
    budget: r.budget,
    deadline: r.deadline,
    quote: r.quotePrice === null ? null : { price: r.quotePrice, deliveryDays: r.quoteDeliveryDays, note: r.quoteNote, validUntil: r.quoteValidUntil, quotedAt: r.quotedAt },
    shop: r.shop,
    customer: { id: r.user.id, name: r.user.fullName },
    order: r.order,
    messages: r.messages.map((m) => ({ id: m.id, role: m.role, body: m.body, createdAt: m.createdAt, author: m.author?.fullName ?? null })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

@Injectable()
export class CustomOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: SellerContext,
    private readonly addresses: AddressesService,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
    private readonly rules: ProductRules,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Notifies the other side of a request: the shop owner or the customer. */
  private async notifyParty(id: string, to: 'shop' | 'customer', type: string, title: (r: { number: string; designName: string; shop: string }) => string, body: string) {
    const r = await this.prisma.customOrderRequest.findUnique({
      where: { id },
      select: { number: true, designName: true, userId: true, shop: { select: { name: true, ownerId: true } } },
    });
    if (!r) return;
    this.notifications.send({
      userIds: to === 'shop' ? r.shop.ownerId : r.userId,
      category: to === 'shop' ? 'shop' : 'custom_orders',
      type,
      title: title({ number: r.number, designName: r.designName, shop: r.shop.name }),
      body,
      link: to === 'shop' ? `/seller/custom-orders/${id}` : `/account/custom-orders/${id}`,
    });
  }

  /** Approved shops that take custom design requests. */
  async shops() {
    return this.prisma.shop.findMany({
      where: { status: ShopStatus.APPROVED, acceptsCustomOrders: true },
      orderBy: [{ ratingAvg: 'desc' }, { followerCount: 'desc' }],
      select: { id: true, name: true, slug: true, city: true, isVerified: true, ratingAvg: true, ratingCount: true },
      take: 200,
    });
  }

  async create(userId: string, dto: CreateCustomOrderDto, meta: RequestMeta) {
    const design = await this.prisma.customDesign.findFirst({ where: { id: dto.designId, userId } });
    if (!design) throw Errors.notFound('Design');
    const shop = await this.prisma.shop.findFirst({ where: { id: dto.shopId, status: ShopStatus.APPROVED, acceptsCustomOrders: true } });
    if (!shop) throw new AppException('SHOP_UNAVAILABLE', 'This shop is not taking custom orders right now.', 400, [{ field: 'shopId', message: 'Choose another shop' }]);
    if (shop.ownerId === userId) throw new AppException('OWN_SHOP', 'You cannot order from your own shop.', 400);
    if (dto.deadline && new Date(dto.deadline).getTime() < Date.now() + DAY) {
      throw new AppException('DEADLINE_INVALID', 'Give the shop at least a day.', 400, [{ field: 'deadline', message: 'Too soon' }]);
    }
    await this.rules.assertAllowedIn('requirements', dto.requirements);

    const request = await this.prisma.customOrderRequest.create({
      data: {
        number: newOrderNumber('CO'),
        userId,
        shopId: shop.id,
        designId: design.id,
        designSnapshot: design.design as Prisma.InputJsonValue,
        designName: design.name,
        quantity: dto.quantity,
        requirements: dto.requirements,
        budget: dto.budget ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        messages: { create: { role: 'system', body: `Request sent to ${shop.name}.` } },
      },
    });
    await this.audit.log({ actorId: userId, action: 'custom_order.create', entityType: 'custom_order', entityId: request.id, meta });
    void this.notifyParty(request.id, 'shop', 'custom_order.new', (r) => `New custom kite request ${r.number}`, `${dto.quantity} × “${design.name}”. Reply with a quote or a question.`);
    return this.forCustomer(userId, request.id);
  }

  async listForCustomer(userId: string, q: CustomOrderQueryDto) {
    const where: Prisma.CustomOrderRequestWhereInput = { userId, ...(q.status && { status: q.status }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customOrderRequest.findMany({ where, include: requestInclude, orderBy: { updatedAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.customOrderRequest.count({ where }),
    ]);
    return new Paginated(rows.map(toRequest), total, q);
  }

  async forCustomer(userId: string, id: string) {
    const r = await this.prisma.customOrderRequest.findFirst({ where: { id, userId }, include: requestInclude });
    if (!r) throw Errors.notFound('Request');
    return toRequest(r);
  }

  async customerMessage(userId: string, id: string, dto: MessageDto, meta: RequestMeta) {
    const r = await this.forCustomer(userId, id);
    if (!OPEN.includes(r.status)) throw badState('This request is closed.');
    await this.rules.assertAllowedIn('body', dto.body);
    await this.prisma.$transaction([
      this.prisma.customOrderMessage.create({ data: { requestId: id, authorId: userId, role: 'customer', body: dto.body } }),
      // Answering the shop's question puts the request back in its queue.
      ...(r.status === CustomOrderStatus.CLARIFICATION_NEEDED
        ? [this.prisma.customOrderRequest.update({ where: { id }, data: { status: CustomOrderStatus.REQUESTED } })]
        : [this.prisma.customOrderRequest.update({ where: { id }, data: { updatedAt: new Date() } })]),
    ]);
    await this.audit.log({ actorId: userId, action: 'custom_order.message', entityType: 'custom_order', entityId: id, meta });
    void this.notifyParty(id, 'shop', 'custom_order.message', (r) => `New message on ${r.number}`, dto.body.length > 140 ? `${dto.body.slice(0, 137)}…` : dto.body);
    return this.forCustomer(userId, id);
  }

  private async move(id: string, from: CustomOrderStatus[], to: CustomOrderStatus, extra: Prisma.CustomOrderRequestUpdateManyMutationInput = {}) {
    const { count } = await this.prisma.customOrderRequest.updateMany({ where: { id, status: { in: from } }, data: { status: to, ...extra } });
    if (count === 0) throw badState('This request was just updated. Refresh and try again.');
  }

  async cancel(userId: string, id: string, meta: RequestMeta) {
    const r = await this.forCustomer(userId, id);
    if (!OPEN.includes(r.status)) throw badState('Only open requests can be cancelled.');
    await this.move(id, OPEN, CustomOrderStatus.CANCELLED);
    await this.prisma.customOrderMessage.create({ data: { requestId: id, role: 'system', body: 'The customer cancelled the request.' } });
    await this.audit.log({ actorId: userId, action: 'custom_order.cancel', entityType: 'custom_order', entityId: id, meta });
    void this.notifyParty(id, 'shop', 'custom_order.cancelled', (r) => `Request ${r.number} was cancelled`, 'The customer withdrew this custom kite request.');
    return this.forCustomer(userId, id);
  }

  async decline(userId: string, id: string, meta: RequestMeta) {
    const r = await this.forCustomer(userId, id);
    if (r.status !== CustomOrderStatus.QUOTED) throw badState('There is no quote to decline.');
    await this.move(id, [CustomOrderStatus.QUOTED], CustomOrderStatus.DECLINED);
    await this.prisma.customOrderMessage.create({ data: { requestId: id, role: 'system', body: 'The customer declined the quote.' } });
    await this.audit.log({ actorId: userId, action: 'custom_order.decline', entityType: 'custom_order', entityId: id, meta });
    void this.notifyParty(id, 'shop', 'custom_order.declined', (r) => `Quote declined for ${r.number}`, 'The customer declined your quote.');
    return this.forCustomer(userId, id);
  }

  /**
   * The customer accepts the quote: a normal order is created for the shop (no stock involved),
   * priced exactly as quoted plus the delivery fee, and it then follows the usual order flow.
   */
  async accept(userId: string, id: string, dto: AcceptQuoteDto, meta: RequestMeta) {
    const r = await this.prisma.customOrderRequest.findFirst({ where: { id, userId }, include: { shop: true } });
    if (!r) throw Errors.notFound('Request');
    if (r.status !== CustomOrderStatus.QUOTED || r.quotePrice === null) throw badState('There is no quote to accept.');
    if (r.quoteValidUntil && r.quoteValidUntil < new Date()) throw badState('This quote has expired. Ask the shop for a new one.');
    if (r.shop.status !== ShopStatus.APPROVED) throw badState('This shop is not taking orders right now.');

    const provider = await this.payments.get(dto.paymentMethod);
    if (!provider) throw Errors.paymentMethodUnavailable();
    const method = (await this.settings.get('checkout.delivery_methods')).find((m) => m.key === dto.deliveryMethod);
    if (!method) throw Errors.deliveryMethodInvalid();
    const address = await this.addresses.ensureOwned(userId, dto.addressId);
    const shippingFee = method.freeAbove !== null && r.quotePrice >= method.freeAbove ? 0 : method.fee;
    const total = r.quotePrice + shippingFee;
    const orderNumber = newOrderNumber();
    const image = (r.designSnapshot as { imageUrl?: string | null }).imageUrl ?? null;

    const order = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.customOrderRequest.updateMany({ where: { id, status: CustomOrderStatus.QUOTED }, data: { status: CustomOrderStatus.ACCEPTED } });
      if (moved.count === 0) throw badState('This request was just updated. Refresh and try again.');
      const o = await tx.order.create({
        data: {
          orderNumber,
          checkoutId: `custom-${id}`,
          userId,
          shopId: r.shopId,
          subtotal: r.quotePrice!,
          shippingFee,
          total,
          deliveryMethod: method.key,
          paymentMethod: provider.key,
          shippingAddress: { fullName: address.fullName, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, province: address.province, postalCode: address.postalCode },
          contactPhone: address.phone,
          notes: `Custom order ${r.number}`,
          items: {
            create: {
              title: `Custom kite: ${r.designName}`,
              imageUrl: image,
              unitPrice: Math.round(r.quotePrice! / r.quantity),
              quantity: r.quantity,
              lineTotal: r.quotePrice!,
            },
          },
          events: { create: { status: OrderStatus.PENDING, note: `Placed from custom quote ${r.number}`, actorId: userId } },
        },
      });
      await tx.customOrderRequest.update({ where: { id }, data: { orderId: o.id } });
      await tx.customOrderMessage.create({ data: { requestId: id, role: 'system', body: `Quote accepted. Order ${orderNumber} was created.` } });
      return o;
    });
    const initiation = await provider.initiate({ orderNumbers: [orderNumber], amount: total });
    await this.prisma.payment.create({
      data: { orderId: order.id, provider: provider.key, amount: total, status: initiation.status, metadata: { instructions: initiation.instructions } },
    });
    await this.audit.log({ actorId: userId, action: 'custom_order.accept', entityType: 'custom_order', entityId: id, metadata: { orderNumber }, meta });
    void this.notifyParty(id, 'shop', 'custom_order.accepted', () => `Quote accepted: order ${orderNumber}`, `The customer accepted your quote for “${r.designName}”. It is now in your orders.`);
    this.notifications.send({
      userIds: userId,
      category: 'orders',
      type: 'order.placed',
      title: `Order ${orderNumber} placed`,
      body: `Your custom kite order is with ${r.shop.name}. ${initiation.instructions}`,
      link: `/account/orders/${orderNumber}`,
    });
    return { ...(await this.forCustomer(userId, id)), paymentInstructions: initiation.instructions };
  }

  // ─── Seller side ──────────────────────────────────────────────────────────

  async listForSeller(userId: string, q: CustomOrderQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const where: Prisma.CustomOrderRequestWhereInput = { shopId: shop.id, ...(q.status && { status: q.status }) };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.customOrderRequest.findMany({ where, include: requestInclude, orderBy: { updatedAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.customOrderRequest.count({ where }),
      this.prisma.customOrderRequest.groupBy({ by: ['status'], where: { shopId: shop.id }, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(rows.map(toRequest), total, q);
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async forSeller(userId: string, id: string) {
    const shop = await this.ctx.approvedShop(userId);
    const r = await this.prisma.customOrderRequest.findFirst({ where: { id, shopId: shop.id }, include: requestInclude });
    if (!r) throw Errors.notFound('Request');
    return toRequest(r);
  }

  async sellerMessage(userId: string, id: string, dto: MessageDto, meta: RequestMeta) {
    const r = await this.forSeller(userId, id);
    if (!OPEN.includes(r.status)) throw badState('This request is closed.');
    await this.prisma.$transaction([
      this.prisma.customOrderMessage.create({ data: { requestId: id, authorId: userId, role: 'seller', body: dto.body } }),
      this.prisma.customOrderRequest.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    await this.audit.log({ actorId: userId, action: 'custom_order.seller_message', entityType: 'custom_order', entityId: id, meta });
    void this.notifyParty(id, 'customer', 'custom_order.message', (r) => `${r.shop} sent a message`, dto.body.length > 140 ? `${dto.body.slice(0, 137)}…` : dto.body);
    return this.forSeller(userId, id);
  }

  async clarify(userId: string, id: string, dto: MessageDto, meta: RequestMeta) {
    await this.forSeller(userId, id);
    await this.move(id, [CustomOrderStatus.REQUESTED], CustomOrderStatus.CLARIFICATION_NEEDED);
    await this.prisma.customOrderMessage.create({ data: { requestId: id, authorId: userId, role: 'seller', body: dto.body } });
    await this.audit.log({ actorId: userId, action: 'custom_order.clarify', entityType: 'custom_order', entityId: id, meta });
    void this.notifyParty(id, 'customer', 'custom_order.clarify', (r) => `${r.shop} has a question about “${r.designName}”`, dto.body.length > 140 ? `${dto.body.slice(0, 137)}…` : dto.body);
    return this.forSeller(userId, id);
  }

  /** Sends or revises a quote. */
  async quote(userId: string, id: string, dto: QuoteDto, meta: RequestMeta) {
    await this.forSeller(userId, id);
    const validUntil = new Date(Date.now() + dto.validDays * DAY);
    await this.move(id, OPEN, CustomOrderStatus.QUOTED, {
      quotePrice: dto.price,
      quoteDeliveryDays: dto.deliveryDays,
      quoteNote: dto.note || null,
      quoteValidUntil: validUntil,
      quotedAt: new Date(),
    });
    await this.prisma.customOrderMessage.create({
      data: {
        requestId: id,
        authorId: userId,
        role: 'seller',
        body: `Quote: Rs ${dto.price.toLocaleString('en-PK')} for the order, ready in ${dto.deliveryDays} days. Valid until ${validUntil.toDateString()}.${dto.note ? `\n${dto.note}` : ''}`,
      },
    });
    await this.audit.log({ actorId: userId, action: 'custom_order.quote', entityType: 'custom_order', entityId: id, metadata: { price: dto.price }, meta });
    void this.notifyParty(
      id,
      'customer',
      'custom_order.quote',
      (r) => `Quote from ${r.shop}: Rs ${dto.price.toLocaleString('en-PK')}`,
      `Ready in ${dto.deliveryDays} days. Valid until ${validUntil.toDateString()}. Accept it to place the order.`,
    );
    return this.forSeller(userId, id);
  }

  async reject(userId: string, id: string, dto: ReasonDto, meta: RequestMeta) {
    await this.forSeller(userId, id);
    await this.move(id, OPEN, CustomOrderStatus.REJECTED);
    await this.prisma.customOrderMessage.create({ data: { requestId: id, authorId: userId, role: 'seller', body: `The shop cannot take this order: ${dto.reason}` } });
    await this.audit.log({ actorId: userId, action: 'custom_order.reject', entityType: 'custom_order', entityId: id, meta });
    void this.notifyParty(id, 'customer', 'custom_order.rejected', (r) => `${r.shop} cannot make “${r.designName}”`, `Reason: ${dto.reason} You can send the design to another shop.`);
    return this.forSeller(userId, id);
  }
}

@ApiTags('Custom kites')
@ApiBearerAuth()
@Controller()
export class CustomOrdersController {
  constructor(
    private readonly designs: DesignsService,
    private readonly orders: CustomOrdersService,
  ) {}

  @Get('designs')
  listDesigns(@CurrentUser() user: AuthUser) {
    return this.designs.list(user.id);
  }

  @Get('designs/:id')
  getDesign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.designs.get(user.id, id);
  }

  @Post('designs')
  createDesign(@CurrentUser() user: AuthUser, @Body() dto: SaveDesignDto) {
    return this.designs.create(user.id, dto);
  }

  @Put('designs/:id')
  updateDesign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveDesignDto) {
    return this.designs.update(user.id, id, dto);
  }

  @Delete('designs/:id')
  deleteDesign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.designs.remove(user.id, id);
  }

  @Public()
  @Get('custom-orders/shops')
  @ApiOperation({ summary: 'Shops that accept custom design requests' })
  shops() {
    return this.orders.shops();
  }

  @Post('custom-orders')
  @ApiOperation({ summary: 'Ask a shop for a quote on a saved design' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomOrderDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.create(user.id, dto, meta);
  }

  @Get('custom-orders')
  list(@CurrentUser() user: AuthUser, @Query() q: CustomOrderQueryDto) {
    return this.orders.listForCustomer(user.id, q);
  }

  @Get('custom-orders/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.forCustomer(user.id, id);
  }

  @Post('custom-orders/:id/messages')
  message(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.customerMessage(user.id, id, dto, meta);
  }

  @Post('custom-orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept the quote and place the order' })
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AcceptQuoteDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.accept(user.id, id, dto, meta);
  }

  @Post('custom-orders/:id/decline')
  @HttpCode(HttpStatus.OK)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.orders.decline(user.id, id, meta);
  }

  @Post('custom-orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.orders.cancel(user.id, id, meta);
  }
}

@ApiTags('Seller')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
@Controller('seller/custom-orders')
export class SellerCustomOrdersController {
  constructor(private readonly orders: CustomOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: CustomOrderQueryDto) {
    return this.orders.listForSeller(user.id, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.forSeller(user.id, id);
  }

  @Post(':id/messages')
  message(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.sellerMessage(user.id, id, dto, meta);
  }

  @Post(':id/clarify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask the customer a question before quoting' })
  clarify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.clarify(user.id, id, dto, meta);
  }

  @Post(':id/quote')
  @HttpCode(HttpStatus.OK)
  quote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: QuoteDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.quote(user.id, id, dto, meta);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReasonDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.reject(user.id, id, dto, meta);
  }
}

@Module({
  imports: [ShoppingModule],
  controllers: [CustomOrdersController, SellerCustomOrdersController],
  providers: [DesignsService, CustomOrdersService, SellerContext, ProductRules],
})
export class CustomOrdersModule {}

