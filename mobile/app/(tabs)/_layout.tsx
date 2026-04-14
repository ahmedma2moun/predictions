import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconName)}
      size={24}
      color={focused ? Colors.primary : Colors.textMuted}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle:      { backgroundColor: Colors.card },
        headerTintColor:  Colors.text,
        headerTitleStyle: { fontWeight: '700', color: Colors.text },
        tabBarStyle: {
          backgroundColor:  Colors.tabBar,
          borderTopColor:   Colors.tabBarBorder,
          borderTopWidth:   1,
          height:           60,
          paddingBottom:    8,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="matches"
        options={{
          title:     'Matches',
          headerTitle: 'Upcoming Matches',
          tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="picks"
        options={{
          title:     'My Picks',
          headerTitle: 'My Predictions',
          tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title:     'Leaderboard',
          tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title:      'Account',
          headerTitle: 'My Account',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
