import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { FytrakTabBar } from "./FytrakTabBar";
import { CoachHomeScreen } from "../screens/coach/CoachHomeScreen";
import { CoachClientsScreen } from "../screens/coach/CoachClientsScreen";
import { CoachLibraryScreen } from "../screens/coach/CoachLibraryScreen";
import { CoachInboxScreen } from "../screens/coach/CoachInboxScreen";
import { CoachProfileScreen } from "../screens/coach/CoachProfileScreen";
import { SessionState } from "../state/types";
import type { CoachTabsParamList } from "./types";

/*
 * Material top tabs rendered at the bottom, matching TraineeTabs.
 *
 * This was a bottom-tab navigator, which has no swipe: the coach could only
 * change section by hitting the tab bar, while the trainee side of the same app
 * swiped. Material top tabs are what give TraineeTabs its pager, so using the
 * same navigator here is what makes the gesture consistent rather than
 * bolting a PanResponder onto the old one.
 */
const Tab = createMaterialTopTabNavigator<CoachTabsParamList>();

export function CoachTabs({ session }: { session: SessionState }) {
    return (
        <Tab.Navigator
            initialRouteName="CoachHome"
            tabBarPosition="bottom"
            screenOptions={{
                // Mount each section on first visit rather than all five at
                // startup — the coach dashboard, roster and inbox each open
                // their own Firestore listeners.
                lazy: true,
                swipeEnabled: true,
            }}
            tabBar={(props) => <FytrakTabBar {...props} />}
        >
            <Tab.Screen name="CoachHome" component={CoachHomeScreen} />
            <Tab.Screen name="CoachClients" component={CoachClientsScreen} />
            <Tab.Screen name="CoachLibrary" component={CoachLibraryScreen} />
            <Tab.Screen name="CoachInbox" component={CoachInboxScreen} />
            <Tab.Screen name="CoachProfile">
                {() => <CoachProfileScreen session={session} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}
