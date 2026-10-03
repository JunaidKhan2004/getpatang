import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/features/notifications/notifications.dart';

void main() {
  test('maps web links from notifications to app routes', () {
    expect(appRouteFor('/account/orders/KP-261002-ABC'), '/orders/KP-261002-ABC');
    expect(appRouteFor('/account/custom-orders/c1'), '/custom-orders/c1');
    expect(appRouteFor('/tournaments/spring-cup?tab=schedule'), '/tournament/spring-cup');
    expect(appRouteFor('/events/basant'), '/event/basant');
    expect(appRouteFor('/community/posts/p1'), '/post/p1');
    expect(appRouteFor('/seller/orders/KP-1'), isNull);
    expect(appRouteFor(null), isNull);
  });
}
