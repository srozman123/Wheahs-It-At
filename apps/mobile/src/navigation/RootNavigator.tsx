import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppState } from '../hooks/useAppState';
import { AuthScreen } from '../screens/AuthScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { GoingScreen } from '../screens/GoingScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PostEventScreen } from '../screens/PostEventScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors } from '../theme';
import { TabBar } from './TabBar';

type RootStack = {
  Welcome: undefined;
  Auth: { mode: 'signup' | 'login' };
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStack>();
const Tabs = createBottomTabNavigator();

const theme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.cream, card: colors.cream, text: colors.ink, primary: colors.green.base },
};

function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Feed" component={FeedScreen} />
      <Tabs.Screen name="Saved" component={SavedScreen} />
      <Tabs.Screen name="Post">{({ navigation }) => <PostEventScreen onDone={() => navigation.navigate('Feed')} />}</Tabs.Screen>
      <Tabs.Screen name="Going" component={GoingScreen} />
      <Tabs.Screen name="Friends" component={FriendsScreen} />
    </Tabs.Navigator>
  );
}

/**
 * Logged out → Welcome / Auth. Signed up but not onboarded → Onboarding.
 * Otherwise → the tabs. Switching state swaps the whole stack.
 */
export function RootNavigator() {
  const { user, onboarded } = useAppState();

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.cream } }}>
        {!user ? (
          <>
            <Stack.Screen name="Welcome">
              {({ navigation }) => (
                <WelcomeScreen
                  onSignUp={() => navigation.navigate('Auth', { mode: 'signup' })}
                  onLogIn={() => navigation.navigate('Auth', { mode: 'login' })}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Auth">
              {({ navigation, route }) => <AuthScreen initialMode={route.params.mode} onBack={() => navigation.goBack()} />}
            </Stack.Screen>
          </>
        ) : !onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
