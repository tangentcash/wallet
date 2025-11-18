import { Navigate, useLocation } from "react-router";
import { AppData } from "../core/app";
import { Navbar } from "./navbar";
import { JSX } from "react";

export function WalletReadyRoute(props: { children: React.ReactNode }): JSX.Element {
  const location = useLocation();
  if (!AppData.isWalletReady()) {
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
  if (AppData.isWalletReady())
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;
  
  return <>{props.children}</>;
}