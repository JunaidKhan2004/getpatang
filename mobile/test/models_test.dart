import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/core/utils/validators.dart';
import 'package:kite_platform/features/designer/designer_repository.dart';
import 'package:kite_platform/features/events/events.dart';
import 'package:kite_platform/features/marketplace/data/models.dart';

/// Shapes below are copied from real API responses, so a backend change that breaks the app fails here.
void main() {
  const design = {
    'shape': 'patang',
    'size': 'medium',
    'background': '#420000',
    'pattern': 'halves',
    'patternColor': '#F6F6F6',
    'text': null,
    'textColor': '#F6F6F6',
    'font': 'display',
    'imageUploadId': null,
    'imageUrl': null,
    'tail': true,
    'tailColor': '#D4D7DD',
  };

  test('parses an event with my registration and a linked tournament', () {
    final e = EventData.fromJson({
      'id': 'e1',
      'slug': 'basant-day',
      'name': 'Basant Day',
      'type': 'festival',
      'city': 'Lahore',
      'venue': 'Jilani Park',
      'startsAt': '2026-10-20T10:00:00.000Z',
      'endsAt': null,
      'organizerName': 'Club',
      'fee': 0,
      'capacity': 200,
      'registrationRequired': true,
      'registrationClosesAt': null,
      'status': 'PUBLISHED',
      'attending': 12,
      'registrationOpen': true,
      'maxGuests': 3,
      'safetyNotes': 'Cotton string only.',
      'waitlisted': 1,
      'myRegistration': {'status': 'WAITLISTED', 'guests': 2},
      'tournament': {'slug': 'spring-cup', 'name': 'Spring Cup'},
    });
    expect(e.myStatus, 'WAITLISTED');
    expect(e.myGuests, 2);
    expect(e.tournamentSlug, 'spring-cup');
    expect(e.startsAt.isUtc, isFalse); // shown in local time
  });

  test('parses a quoted custom order and works out what the customer can do', () {
    final r = CustomOrderData.fromJson({
      'id': 'c1',
      'number': 'CO-261002-ABCDEF',
      'status': 'QUOTED',
      'quoteExpired': false,
      'designName': 'Falcon',
      'design': design,
      'quantity': 20,
      'requirements': 'Twenty kites',
      'budget': null,
      'deadline': null,
      'quote': {
        'price': 5500,
        'deliveryDays': 7,
        'note': null,
        'validUntil': '2026-10-09T00:00:00.000Z',
        'quotedAt': '2026-10-02T00:00:00.000Z',
      },
      'shop': {'id': 's1', 'name': 'Patang Ghar', 'slug': 'patang-ghar', 'city': 'Lahore', 'phone': null},
      'customer': {'id': 'u1', 'name': 'Ali'},
      'order': null,
      'messages': [
        {
          'id': 'm1',
          'role': 'system',
          'body': 'Request sent.',
          'createdAt': '2026-10-02T00:00:00.000Z',
          'author': null,
        },
      ],
      'createdAt': '2026-10-02T00:00:00.000Z',
      'updatedAt': '2026-10-02T00:00:00.000Z',
    });
    expect(r.canAccept, isTrue);
    expect(r.isOpen, isTrue);
    expect(r.quotePrice, 5500);
    expect(r.design.text, '');
    expect(r.statusLabel, 'Quote received');
  });

  test('parses payment proof state and refunds on an order', () {
    final o = OrderDetailData.fromJson({
      'orderNumber': 'KP-1',
      'status': 'CANCELLED',
      'createdAt': '2026-10-02T00:00:00.000Z',
      'subtotal': 2000,
      'shippingFee': 250,
      'discount': 0,
      'total': 2250,
      'shippingAddress': {
        'fullName': 'Ali',
        'phone': '03001234567',
        'line1': 'House 1',
        'line2': null,
        'city': 'Lahore',
        'postalCode': null,
      },
      'shop': {'name': 'Patang Ghar', 'phone': null, 'email': null},
      'items': <Object>[],
      'timeline': <Object>[],
      'progress': ['PENDING'],
      'payment': {
        'method': 'bank_transfer',
        'label': 'Bank transfer',
        'status': 'PAID',
        'instructions': null,
        'reference': 'TXN1',
        'reviewNote': null,
        'canSubmitProof': false,
      },
      'refunds': [
        {
          'amount': 2250,
          'status': 'PENDING',
          'reference': null,
          'createdAt': '2026-10-02T00:00:00.000Z',
          'processedAt': null,
        },
      ],
      'canCancel': false,
    });
    expect(o.paymentReference, 'TXN1');
    expect(o.canSubmitProof, isFalse);
    expect(o.refunds.single.amount, 2250);
    expect(paymentStatusLabels[o.paymentStatus], 'Paid');
  });

  test('validators match the API rules', () {
    expect(Validators.email('flyer@example.com'), isNull);
    expect(Validators.email('not-an-email'), isNotNull);
    expect(Validators.optionalPhone(''), isNull);
    expect(Validators.optionalPhone('03001234567'), isNull);
    expect(Validators.optionalPhone('+923001234567'), isNull);
    expect(Validators.optionalPhone('12345'), isNotNull);
    expect(Validators.password('short1'), isNotNull);
    expect(Validators.password('flyHigh2027'), isNull);
    expect(Validators.otp('123456'), isNull);
    expect(Validators.otp('12345'), isNotNull);
  });
}
