// Loaded like the app's own modules (through tsx), so tests get the same copy of react-query the components use.
// A bare import("@tanstack/react-query") from a test resolves to its ESM build, a different module instance with a
// different React context, and components then report "No QueryClient set".
export { QueryClient, QueryClientProvider } from "@tanstack/react-query";
