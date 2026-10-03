import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class QuoteDto {
  @ApiProperty({ example: 'standard' })
  @IsString()
  deliveryMethod: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || undefined : value))
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}

export class PlaceOrderDto extends QuoteDto {
  @ApiProperty()
  @IsString({ message: 'Choose a delivery address' })
  addressId: string;

  @ApiProperty({ example: 'cod' })
  @IsString({ message: 'Choose a payment method' })
  paymentMethod: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: 'Notes can be at most 300 characters' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Client-generated UUID. Re-sending it never creates duplicate orders.' })
  @IsOptional()
  @IsUUID()
  checkoutId?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 300)
  reason?: string;
}
