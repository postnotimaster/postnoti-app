// 👇👇👇 주의: 관리자용 앱을 빌드할 때는 아래를 true로, 입주자용 앱을 빌드할 때는 false로 바꾸세요! 👇👇👇
const IS_ADMIN = true;
// 👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

export default {
  expo: {
    name: IS_ADMIN ? "포스트노티" : "우편알림",
    slug: "postnoti-app",
    scheme: "postnoti",
    version: "1.0.0",
    orientation: "portrait",
    icon: IS_ADMIN ? "./assets/icon.png" : "./assets/icon_tenant.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.postnoti.app"
    },
    android: {
      package: "com.postnoti.app",
      versionCode: 1,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: IS_ADMIN ? "./assets/adaptive-icon.png" : "./assets/adaptive-icon_tenant.png",
        backgroundColor: "#4A60AB"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png",
      display: "standalone",
      themeColor: "#FEF3C7",
      description: "포스트노티 공유오피스 스마트 우편알림",
      name: "우편알림",
      shortName: "우편알림",
      startUrl: "."
    },
    extra: {
      eas: {
        projectId: "b970de52-12b9-46d4-b6b6-563385365c00"
      }
    }
  }
};
