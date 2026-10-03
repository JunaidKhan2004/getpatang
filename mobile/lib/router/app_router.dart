import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/application/auth_controller.dart';
import '../features/auth/data/auth_models.dart';
import '../features/auth/presentation/complete_profile_screen.dart';
import '../features/auth/presentation/forgot_password_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/auth/presentation/reset_password_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/auth/presentation/verify_otp_screen.dart';
import '../features/marketplace/presentation/cart_screen.dart';
import '../features/marketplace/presentation/checkout_screen.dart';
import '../features/marketplace/presentation/home_tab.dart';
import '../features/marketplace/presentation/marketplace_tab.dart';
import '../features/marketplace/presentation/orders_screens.dart';
import '../features/marketplace/presentation/product_screen.dart';
import '../features/marketplace/presentation/search_screen.dart';
import '../features/marketplace/presentation/shop_screen.dart';
import '../features/community/presentation/community_screens.dart';
import '../features/content/content_page.dart';
import '../features/designer/designer_screens.dart';
import '../features/events/events.dart';
import '../features/notifications/notifications.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/tournaments/presentation/rankings_screens.dart';
import '../features/tournaments/presentation/tournament_screen.dart';
import '../features/tournaments/presentation/tournaments_tab.dart';
import '../features/onboarding/onboarding_store.dart';
import '../features/profile/profile_tab.dart';
import '../features/shell/main_shell.dart';

/// Screens only for signed-out users.
const _authRoutes = {'/login', '/register', '/verify-otp', '/forgot-password', '/reset-password'};

/// Screens that need a signed-in user. Everything else can be browsed as a guest.
const _protectedPrefixes = [
  '/cart',
  '/checkout',
  '/order-placed',
  '/orders',
  '/wishlist',
  '/my-tournaments',
  '/my-events',
  '/designs',
  '/custom-orders',
  '/notifications',
  '/notification-settings',
];

final routerProvider = Provider<GoRouter>((ref) {
  // Bridges Riverpod state into go_router's refreshListenable.
  final refresh = ValueNotifier(0);
  ref.listen(authControllerProvider, (_, _) => refresh.value++);
  ref.listen(onboardingSeenProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final seenOnboarding = ref.read(onboardingSeenProvider);
      final path = state.matchedLocation;

      if (auth is AuthRestoring) return path == '/splash' ? null : '/splash';

      if (auth is Authenticated) {
        if (auth.user.needsProfile) return path == '/complete-profile' ? null : '/complete-profile';
        final leavingAuth =
            path == '/splash' || path == '/onboarding' || path == '/complete-profile' || _authRoutes.contains(path);
        return leavingAuth ? (state.uri.queryParameters['from'] ?? '/home') : null;
      }

      // Signed out
      if (path == '/splash') return seenOnboarding ? '/home' : '/onboarding';
      if (path == '/complete-profile') return '/login';
      if (_protectedPrefixes.any(path.startsWith)) {
        return Uri(path: '/login', queryParameters: {'from': state.uri.toString()}).toString();
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/verify-otp',
        builder: (_, s) => VerifyOtpScreen(
          email: s.uri.queryParameters['email'] ?? '',
          purpose: OtpPurpose.parse(s.uri.queryParameters['purpose']),
        ),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (_, s) =>
            ResetPasswordScreen(email: s.uri.queryParameters['email'] ?? '', code: s.uri.queryParameters['code'] ?? ''),
      ),
      GoRoute(path: '/complete-profile', builder: (_, _) => const CompleteProfileScreen()),
      GoRoute(path: '/cart', builder: (_, _) => const CartScreen()),
      GoRoute(path: '/checkout', builder: (_, _) => const CheckoutScreen()),
      GoRoute(
        path: '/order-placed',
        builder: (_, s) => OrderPlacedScreen(
          result: s.extra as ({String checkoutId, String? instructions, int total, List<String> orderNumbers})?,
        ),
      ),
      GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
      GoRoute(
        path: '/orders/:number',
        builder: (_, s) => OrderScreen(orderNumber: s.pathParameters['number']!),
      ),
      GoRoute(path: '/wishlist', builder: (_, _) => const WishlistScreen()),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
      GoRoute(path: '/shops', builder: (_, _) => const ShopsScreen()),
      GoRoute(
        path: '/product/:slug',
        builder: (_, s) => ProductScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/shop/:slug',
        builder: (_, s) => ShopScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/tournament/:slug',
        builder: (_, s) => TournamentScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(path: '/rankings', builder: (_, _) => const RankingsScreen()),
      GoRoute(path: '/compose', builder: (_, _) => const ComposeScreen()),
      GoRoute(
        path: '/post/:id',
        builder: (_, s) => PostScreen(postId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/u/:id',
        builder: (_, s) => CommunityProfileScreen(userId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/player/:id',
        builder: (_, s) => PlayerScreen(userId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/my-tournaments', builder: (_, _) => const MyTournamentsScreen()),
      GoRoute(path: '/events', builder: (_, _) => const EventsScreen()),
      GoRoute(
        path: '/event/:slug',
        builder: (_, s) => EventScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(path: '/my-events', builder: (_, _) => const MyEventsScreen()),
      GoRoute(
        path: '/designer',
        builder: (_, s) =>
            DesignerScreen(key: ValueKey(s.uri.queryParameters['id']), designId: s.uri.queryParameters['id']),
      ),
      GoRoute(path: '/designs', builder: (_, _) => const MyDesignsScreen()),
      GoRoute(path: '/custom-orders', builder: (_, _) => const CustomOrdersScreen()),
      GoRoute(
        path: '/custom-orders/new',
        builder: (_, s) => RequestQuoteScreen(designId: s.uri.queryParameters['design']),
      ),
      GoRoute(
        path: '/custom-orders/:id',
        builder: (_, s) => CustomOrderScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/notification-settings', builder: (_, _) => const NotificationSettingsScreen()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(
        path: '/legal/:doc',
        builder: (_, s) => ContentPageScreen(slug: s.pathParameters['doc']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MainShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/home', builder: (_, _) => const HomeTab())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/marketplace',
                builder: (_, s) => MarketplaceTab(
                  initialCategory: s.uri.queryParameters['category'],
                  initialSort: s.uri.queryParameters['sort'],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/tournaments', builder: (_, _) => const TournamentsTab())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/community', builder: (_, _) => const CommunityTab())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileTab())],
          ),
        ],
      ),
    ],
  );
});
