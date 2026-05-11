import { AppHomeScreen } from "@/components/home/app-home-screen";
import { DesktopUpdateBanner } from "@/components/desktop/desktop-update-banner";

export default function AppPage() {
  return (
    <>
      <DesktopUpdateBanner />
      <AppHomeScreen />
    </>
  );
}
