import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/HomeScreen';
import { AddArticleScreen } from '@/screens/AddArticleScreen';
import { BillingScreen } from '@/screens/BillingScreen';
import { GeneratedBillScreen } from '@/screens/GeneratedBillScreen';
import { BillHistoryScreen } from '@/screens/BillHistoryScreen';
import { BillDetailScreen } from '@/screens/BillDetailScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { BillingCartProvider } from '@/navigation/BillingCartContext';
import { BottomTabParamList, BillingStackParamList, BillsStackParamList } from '@/navigation/types';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const BillingStack = createNativeStackNavigator<BillingStackParamList>();
const BillsStack = createNativeStackNavigator<BillsStackParamList>();

function BillingStackNavigator() {
  return (
    <BillingCartProvider>
      <BillingStack.Navigator screenOptions={{ headerShown: false }}>
        <BillingStack.Screen name="BillingCart" component={BillingScreen} />
        <BillingStack.Screen
          name="GeneratedBill"
          component={GeneratedBillScreen}
          options={{ headerShown: true, title: 'Generated Bill', presentation: 'card' }}
        />
      </BillingStack.Navigator>
    </BillingCartProvider>
  );
}

function BillHistoryStackNavigator() {
  return (
    <BillsStack.Navigator screenOptions={{ headerShown: false }}>
      <BillsStack.Screen name="BillHistoryList" component={BillHistoryScreen} />
      <BillsStack.Screen
        name="BillDetail"
        component={BillDetailScreen}
        options={{ headerShown: true, title: 'Bill Detail' }}
      />
    </BillsStack.Navigator>
  );
}

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>;
}

/**
 * A single persistent bottom tab bar hosts every major section. Billing
 * gets its own nested stack (cart -> generated bill) so the user can drill
 * into the invoice preview while the tab bar stays visible and reachable,
 * per section 7's "must not disappear during billing" requirement.
 */
export function BottomTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1a1a2e' }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="AddArticleTab"
        component={AddArticleScreen}
        options={{
          title: 'Add Article',
          tabBarIcon: ({ focused }) => <TabIcon symbol="➕" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="🧾" focused={focused} /> }}
      />
      <Tab.Screen
        name="BillHistory"
        component={BillHistoryStackNavigator}
        options={{
          title: 'Bill History',
          tabBarIcon: ({ focused }) => <TabIcon symbol="📜" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="⚙️" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
