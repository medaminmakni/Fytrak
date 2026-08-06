const appJson = require("./app.json");

module.exports = () => {
  const appID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const clientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN;

  if (!appID || !clientToken) {
    throw new Error(
      "Facebook native configuration is missing. Set EXPO_PUBLIC_FACEBOOK_APP_ID and EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN."
    );
  }

  return {
    ...appJson.expo,
    plugins: [
      ...appJson.expo.plugins,
      [
        "react-native-fbsdk-next",
        {
          appID,
          clientToken,
          displayName: "Fytrak",
          scheme: `fb${appID}`,
          isAutoInitEnabled: true,
          autoLogAppEventsEnabled: false,
          advertiserIDCollectionEnabled: false,
        },
      ],
    ],
  };
};
