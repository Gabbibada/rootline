import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { TabIcon } from '../../src/components/TabIcon'
import { Colors } from '../../src/theme'

function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      style={{ fontFamily: 'Inter-Regular', fontSize: 11, color, marginBottom: 2 }}
    >
      {label}
    </Text>
  )
}

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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
          tabBarLabel: ({ color }) => <TabLabel label="Home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: 'Tree',
          tabBarIcon: ({ color, focused }) => <TabIcon name="tree" color={color} focused={focused} />,
          tabBarLabel: ({ color }) => <TabLabel label="Tree" color={color} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ color, focused }) => <TabIcon name="family" color={color} focused={focused} />,
          tabBarLabel: ({ color }) => <TabLabel label="Family" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused} />,
          tabBarLabel: ({ color }) => <TabLabel label="Profile" color={color} />,
        }}
      />
    </Tabs>
  )
}
