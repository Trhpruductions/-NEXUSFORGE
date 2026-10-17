import { create } from "zustand";

type ServerViewStore = {
  /** True while a server's channels or voice fill the window. The shell then steps back from the app's own navigation. */
  active: boolean;
  setActive: (active: boolean) => void;
};

export const useServerViewStore = create<ServerViewStore>()((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));
