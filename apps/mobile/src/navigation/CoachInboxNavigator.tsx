import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CoachInboxScreen } from "../screens/coach/CoachInboxScreen";
import { CoachChatScreen } from "../screens/trainee/CoachChatScreen";
import type { CoachInboxStackParamList } from "./types";

const Stack = createNativeStackNavigator<CoachInboxStackParamList>();

export function CoachInboxNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InboxList" component={CoachInboxScreen} />
      <Stack.Screen
        name="CoachConversation"
        listeners={({ navigation }) => ({
          /*
           * A conversation opened from a client report is a temporary
           * drill-down. Once the coach leaves Inbox, discard that child route
           * so returning by tab press or swipe starts at all conversations.
           */
          blur: () => navigation.popToTop(),
        })}
      >
        {({ route }) => (
          <CoachChatScreen
            traineeId={route.params.traineeId}
            coachId={route.params.coachId}
            traineeName={route.params.traineeName}
            threadId={route.params.threadId}
            assignmentId={route.params.assignmentId}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
