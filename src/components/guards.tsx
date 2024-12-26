import { Navigate, useLocation } from "react-router";
import { SafeStorage } from "../core/storage";
import { Wallet } from "../core/wallet";
import { Navbar } from "./navbar";

function hasWallet(): boolean {
  return SafeStorage.hasDecryptedKey() && Wallet.isReady();
}

export function WalletReadyRoute(props: { children: React.ReactNode }): JSX.Element {
  const location = useLocation();
  if (!hasWallet()) {
    return <Navigate replace={true} to="/restore" state={{ from: `${location.pathname}${location.search}` }} />;
  }
  
  return (
    <>
      {props.children}
      <Navbar path={location.pathname}></Navbar>
    </>
  );
}

export function WalletNotReadyRoute(props: { children: React.ReactNode }): JSX.Element {
  const location = useLocation();
  if (hasWallet())
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;
  
  return <>{props.children}</>;
}