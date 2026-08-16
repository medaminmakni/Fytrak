import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { FytrakTabBar } from "./FytrakTabBar";
import { CoachHomeScreen } from "../screens/coach/CoachHomeScreen";
import { CoachClientsScreen } from "../screens/coach/CoachClientsScreen";
import { CoachLibraryScreen } from "../screens/coach/CoachLibraryScreen";
import { CoachProfileScreen } from "../screens/coach/CoachProfileScreen";
import { CoachInboxNavigator } from "./CoachInboxNavigator";
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
        /*
         * Root tabs support swipe navigation.
         *
         * The bar is bottom-positioned but this is a top-tab navigator, so it
         * ships with horizontal swipe between root destinations. Fytrak is full
         * of horizontal content — the client-day date stepper, chart filter
         * bars, the photo compare slider, exercise rows — and a horizontal drag
         * on those screens was ambiguous: scroll the strip, or change tab. The
         * swipe navigation is intentional and remains available alongside those controls.
         *
         * Tabs change by swiping or by pressing the bottom bar.
         */
        swipeEnabled: true,
            }}
            tabBar={(props) => <FytrakTabBar {...props} />}
        >
            <Tab.Screen name="CoachHome" component={CoachHomeScreen} />
            <Tab.Screen name="CoachClients" component={CoachClientsScreen} />
            <Tab.Screen name="CoachLibrary" component={CoachLibraryScreen} />
            <Tab.Screen
                name="CoachInbox"
                component={CoachInboxNavigator}
                listeners={({ navigation }) => ({
                    /*
                     * A tab press means "Inbox", not "resume whichever client
                     * happened to be open last". This also makes re-tapping
                     * the selected tab return to the conversation list.
                     */
                    tabPress: () => navigation.navigate("CoachInbox", {
                        screen: "InboxList",
                    }),
                })}
            />
            <Tab.Screen name="CoachProfile">
                {() => <CoachProfileScreen session={session} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}
