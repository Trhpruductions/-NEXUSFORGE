"use client";

import { useCallback, useEffect, useState } from "react";
import { listMediaDevices, queryPermission, watchMediaDevices, type PermissionValue } from "@/lib/media/media-devices";

/** The device list and microphone/camera permission. Refreshes on hot-plug and when asked. */
export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphone, setMicrophone] = useState<PermissionValue>("unknown");
  const [camera, setCamera] = useState<PermissionValue>("unknown");

  const refresh = useCallback(async () => {
    const [list, micState, cameraState] = await Promise.all([listMediaDevices(), queryPermission("microphone"), queryPermission("camera")]);
    setDevices(list);
    setMicrophone(micState);
    setCamera(cameraState);
  }, []);

  useEffect(() => {
    void refresh();
    return watchMediaDevices(() => void refresh());
  }, [refresh]);

  return { devices, microphone, camera, refresh };
}
