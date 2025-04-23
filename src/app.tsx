import { useState, StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { WalletReadyRoute, WalletNotReadyRoute } from "./components/guards";
import { BrowserRouter, Route, Routes } from "react-router";
import { Box, Theme } from "@radix-ui/themes";
import { Alert, AlertBox, AlertType } from "./components/alert";
import { core } from '@tauri-apps/api';
import { Interface, NetworkType, Wallet } from "./core/wallet";
import { Storage, StorageField } from "./core/storage";
import RestorePage from "./pages/restore";
import HomePage from "./pages/home";
import ConfigurePage from "./pages/configure";
import AccountPage from "./pages/account";
import BlockPage from "./pages/block";
import TransactionPage from "./pages/transaction";
import InteractionPage from "./pages/interaction";
import DepositoryPage from "./pages/depository"

export type ConnectionState = {
  sentBytes: number;
  receivedBytes: number;
  requests: number;
  responses: number;
  time: Date;
};

export type ServerState = {
  connections: Record<string, ConnectionState>
};

export type AppState = {
  count: number,
  setState: Function | null,
  setAppearance: Function | null
}

export type AppProps = {
  resolver: string | null,
  server: string | null,
  appearance: 'dark' | 'light'
}

export class AppData {
  static root: Root | null = null;
  static server: ServerState = {
    connections: { }
  };
  static state: AppState = {
    count: 0,
    setState: null,
    setAppearance: null
  };
  static props: AppProps = {
    resolver: 'nds.tangent.cash',
    server: '127.0.0.1:18419',
    appearance: 'dark'
  };

  private static request(address: string, method: string, message: any, size: number): void {
    const bytes = 40 + size;
    const server = AppData.server.connections[address];
    if (server != null) {
      server.sentBytes += bytes;
      server.time = new Date();
      ++server.requests;
    } else {
      AppData.server.connections[address] = { sentBytes: bytes, receivedBytes: 0, requests: 1, responses: 0, time: new Date() };
    }
    
    console.log('[rpc]', `${method} on node ${address} call:`, message);
  }
  private static response(address: string, method: string, message: any, size: number): void {
    const bytes = 40 + size;
    const server = AppData.server.connections[address];
    if (server != null) {
      server.receivedBytes += bytes;
      server.time = new Date();
      ++server.responses;
    } else {
      AppData.server.connections[address] = { sentBytes: 0, receivedBytes: bytes, requests: 0, responses: 1, time: new Date() };
    }

    console.log('[rpc]', `${method} on node ${address} return:`, message);
  }
  private static error(address: string, method: string, error: unknown): void {
    const bytes = 40 + (error as any)?.message?.length || 0;
    const server = AppData.server.connections[address];
    const message: string = ((error as any)?.message?.toString() || error?.toString()) || '';
    const networkError = !message.includes('layer_exception');
    if (server != null) {
      server.receivedBytes += bytes;
      server.time = new Date();
      if (!networkError)
        ++server.responses;
    } else {
      AppData.server.connections[address] = { sentBytes: 0, receivedBytes: bytes, requests: 0, responses: networkError ? 0 : 1, time: new Date() };
    }

    console.log('[rpc]', `${method} on node ${address} return:`, (error as any)?.message || error);
    AlertBox.open(AlertType.Error, `${method} on node ${address} has failed: ${(error as any)?.message || error}`);
  }
  private static save(): void {
    Storage.set(StorageField.Props, this.props);
  }
  private static render(): void {
    const element = document.getElementById("root") as HTMLElement;
    this.root = createRoot(element);
    this.root.render(<App />);
  }
  static async main(): Promise<void> {
    const props: AppProps | null = Storage.get(StorageField.Props);
    if (props != null)
      this.props = props;

    Interface.onNodeRequest = this.request;
    Interface.onNodeResponse = this.response;
    Interface.onNodeError = this.error;
    Interface.applyResolver(this.props.resolver);
    Interface.applyServer(this.props.server);
    if (true)
      await Wallet.restore('123456', NetworkType.Regtest);
   
    const splashscreen = document.getElementById('splashscreen-content');
    if (splashscreen != null) {
      splashscreen.style.transition = 'opacity 250ms linear';
      splashscreen.style.opacity = '0';
      splashscreen.ontransitionend = () => this.render();
    } else {
      this.render();
    }
  }
  static openDevTools(): void {
    core.invoke('devtools');
  }
  static setResolver(value: string): void {
    this.props.resolver = value;
    Interface.applyResolver(this.props.resolver);
    this.save();
  }
  static setServer(value: string): void {
    this.props.server = value;
    Interface.applyServer(this.props.server);
    this.save();
  }
  static setAppearance(value: 'dark' | 'light'): void {
    this.props.appearance = value;
    if (this.state.setAppearance != null)
      this.state.setAppearance(value);
    this.save();
  }
  static setState(): void {
    if (this.state.setState != null)
      this.state.setState(++this.state.count);
  }
}

export function App() {
  const [state, setState] = useState(0);
  const [appearance, setAppearance] = useState(AppData.props.appearance);
  // @ts-ignore
  const appearanceValue: 'dark' | 'light' = appearance;
  AppData.state.setState = setState;
  AppData.state.setAppearance = setAppearance;

  return (
    <StrictMode>
      <Theme appearance={appearanceValue} accentColor="iris" radius="full" id={state.toString()}>
        <Box minWidth="285px" maxWidth="800px" mx="auto" style={{ paddingBottom: '96px' }}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={
                <WalletReadyRoute>
                  <HomePage />
                </WalletReadyRoute>
              } />
              <Route path="/configure" element={
                <WalletReadyRoute>
                  <ConfigurePage />
                </WalletReadyRoute>
              } />
              <Route path="/depository" element={
                <WalletReadyRoute>
                  <DepositoryPage />
                </WalletReadyRoute>
              } />
              <Route path="/interaction" element={
                <WalletReadyRoute>
                  <InteractionPage />
                </WalletReadyRoute>
              } />
              <Route path="/block/:id" element={
                <WalletReadyRoute>
                  <BlockPage />
                </WalletReadyRoute>
              } />
              <Route path="/transaction/:id" element={
                <WalletReadyRoute>
                  <TransactionPage />
                </WalletReadyRoute>
              } />
              <Route path="/account/:id" element={
                <WalletReadyRoute>
                  <AccountPage />
                </WalletReadyRoute>
              } />
              <Route path="/restore" element={
                <WalletNotReadyRoute>
                  <RestorePage />
                </WalletNotReadyRoute>
              } />
            </Routes>
          </BrowserRouter>
        </Box>
        <Alert></Alert>
      </Theme>
    </StrictMode>
  )
}