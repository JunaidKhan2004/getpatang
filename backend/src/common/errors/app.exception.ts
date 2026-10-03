import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Domain error with a stable machine-readable `code` (clients branch on it)
 * and a user-safe `message` (clients may show it as-is).
 */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: FieldError[],
  ) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  invalidCredentials: () =>
    new AppException('INVALID_CREDENTIALS', 'The email/phone or password is incorrect.', HttpStatus.UNAUTHORIZED),
  accountNotVerified: () =>
    new AppException(
      'ACCOUNT_NOT_VERIFIED',
      'Please verify your email first. Enter the code we sent to your email.',
      HttpStatus.FORBIDDEN,
    ),
  accountBlocked: () =>
    new AppException(
      'ACCOUNT_BLOCKED',
      'This account has been suspended. Please contact support.',
      HttpStatus.FORBIDDEN,
    ),
  emailTaken: () =>
    new AppException('EMAIL_TAKEN', 'An account with this email already exists.', HttpStatus.CONFLICT, [
      { field: 'email', message: 'This email is already registered' },
    ]),
  phoneTaken: () =>
    new AppException('PHONE_TAKEN', 'An account with this phone number already exists.', HttpStatus.CONFLICT, [
      { field: 'phone', message: 'This phone number is already registered' },
    ]),
  otpInvalid: () => new AppException('OTP_INVALID', 'That code is incorrect. Please check and try again.'),
  otpExpired: () => new AppException('OTP_EXPIRED', 'This code has expired. Please request a new one.'),
  otpTooManyAttempts: () =>
    new AppException('OTP_TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Please request a new code.'),
  otpCooldown: (seconds: number) =>
    new AppException(
      'OTP_COOLDOWN',
      `Please wait ${seconds} seconds before requesting another code.`,
      HttpStatus.TOO_MANY_REQUESTS,
    ),
  sessionExpired: () =>
    new AppException('SESSION_EXPIRED', 'Your session has expired. Please sign in again.', HttpStatus.UNAUTHORIZED),
  unauthenticated: () =>
    new AppException('UNAUTHENTICATED', 'Please sign in to continue.', HttpStatus.UNAUTHORIZED),
  forbidden: () =>
    new AppException('FORBIDDEN', 'You do not have permission to do this.', HttpStatus.FORBIDDEN),
  notFound: (what = 'The requested item') => new AppException('NOT_FOUND', `${what} was not found.`, HttpStatus.NOT_FOUND),

  // Marketplace
  productUnavailable: (title?: string) =>
    new AppException('PRODUCT_UNAVAILABLE', `${title ?? 'This product'} is no longer available.`, HttpStatus.CONFLICT),
  variantRequired: () => new AppException('VARIANT_REQUIRED', 'Please choose an option (size, colour…) first.'),
  outOfStock: (title: string, available: number) =>
    new AppException(
      'OUT_OF_STOCK',
      available > 0 ? `Only ${available} left of ${title}. Please reduce the quantity.` : `${title} is out of stock.`,
      HttpStatus.CONFLICT,
    ),
  cartEmpty: () => new AppException('CART_EMPTY', 'Your cart is empty.'),
  couponInvalid: (reason: string) =>
    new AppException('COUPON_INVALID', reason, HttpStatus.BAD_REQUEST, [{ field: 'couponCode', message: reason }]),
  deliveryMethodInvalid: () =>
    new AppException('DELIVERY_METHOD_INVALID', 'Please choose an available delivery method.', HttpStatus.BAD_REQUEST, [
      { field: 'deliveryMethod', message: 'Choose a delivery method' },
    ]),
  paymentMethodUnavailable: () =>
    new AppException('PAYMENT_METHOD_UNAVAILABLE', 'That payment method is not available right now.', HttpStatus.BAD_REQUEST, [
      { field: 'paymentMethod', message: 'Choose an available payment method' },
    ]),
  orderNotCancellable: () =>
    new AppException(
      'ORDER_NOT_CANCELLABLE',
      'This order can no longer be cancelled because the shop has started preparing it. Please contact the shop.',
      HttpStatus.CONFLICT,
    ),
  reviewNotAllowed: () =>
    new AppException('REVIEW_NOT_ALLOWED', 'You can review a product after an order containing it is delivered.', HttpStatus.FORBIDDEN),
  alreadyReviewed: () => new AppException('ALREADY_REVIEWED', 'You have already reviewed this product.', HttpStatus.CONFLICT),
};
