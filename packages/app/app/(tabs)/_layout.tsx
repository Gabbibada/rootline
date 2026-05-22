import { Tabs } from 'expo-router'
import { TabIcon } from '../../src/components/TabIcon'
import { Colors, Typography } from '../../src/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.amber,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.bark,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: 'Tree',
          tabBarIcon: ({ color, focused }) => <TabIcon name="tree" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ color, focused }) => <TabIcon name="family" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  )
}
