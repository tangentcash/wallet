import { mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiRulerSquareCompass, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useLocation, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { useMemo } from "react";
import Icon from "@mdi/react";

type Route = {
  path: string | string[],
  name: string,
  tip: string,
  icon: string,
  nested?: boolean,
  disabled?: (path: string) => boolean
};

const inclusions: Route[] = [
  { path: ['/', '/explorer', '/block', '/transaction', '/account', '/program'], name: 'Hub', tip: 'Account & Blockchain', icon: mdiSquareRoundedBadgeOutline },
  { path: ['/markets', '/market'], name: 'Dex', tip: 'Trade & Analyze', icon: mdiRulerSquareCompass, nested: true },
  { path: ['/interaction', '/restore'], name: 'Pay', tip: 'Pay & Interact', icon: mdiContactlessPaymentCircleOutline, disabled: (path: string) => path.startsWith('/restore') && !AppData.isWalletReady() },
  { path: ['/configure', '/legal', '/app'], name: 'App', tip: 'Info & Settings', icon: mdiDotsCircle }
];
const exclusions: string[] = [
  '/',
  '/swaps'
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const routes = useMemo((): (Route & { selected: boolean, inner: boolean })[] | null => {
    for (let i = 0; i < exclusions.length; i++) {
      const exclusion = exclusions[i];
      if (exclusion.length == 1 ? location.pathname == '/' && !AppData.isWalletExists() : location.pathname.startsWith(exclusion)) {
        return null;
      }
    }

    const toLongestString = (x: string[]) => {
      let target = '';
      for (let i = 0; i < x.length; i++) {
        if (target.length < x[i].length)
          target = x[i];
      }
      return target;
    };
    const sortedSubtypes = [...inclusions].sort((a, b) => {
      if (a.path == '*')
        return Number.MAX_SAFE_INTEGER;
      else if (b.path == '*')
        return Number.MIN_SAFE_INTEGER;

      let aPath = Array.isArray(a.path) ? toLongestString(a.path) : a.path;
      let bPath = Array.isArray(b.path) ? toLongestString(b.path) : b.path;
      return bPath.length - aPath.length
    });
    const selected = (sortedSubtypes.find((item) => {
      const targets = typeof item.path == 'string' ? [item.path] : item.path;
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (target != '/' ? location.pathname.startsWith(target) : target == location.pathname) {
          return true;
        }
      }
      return false;
    }) || sortedSubtypes[sortedSubtypes.length - 1]).path;
    return inclusions.map((item) => ({
      ...item,
      selected: item.path == selected,
      inner: item.path == selected ? (typeof item.path == 'string' || (item.path[0] == '/' ? location.pathname != '/' : !(item.nested ? item.path[0].startsWith(location.pathname) : location.pathname.startsWith(item.path[0])))) : false
    }));
  }, [location.pathname]);

  AppData.state.setNavigation = navigate;
  if (!routes)
    return <></>;
  
  return (
    <nav className="tabbar" role="navigation">
      {
        routes.map((item) =>
          <button
            key={typeof item.path == 'string' ? item.path : item.path[0]}
            className={ [ item.name == 'Dex' ? 'dex-mode' : '', item.selected ? 'active' : '', item.inner ? 'inner' : '' ].filter(Boolean).join(' ') }
            title={ item.selected && item.inner ? 'Back to ' + item.name : item.tip }
            disabled={item.disabled ? item.disabled(location.pathname) : false}
            onClick={() => {
              if (!item.selected || item.inner) {
                navigate(typeof item.path == 'string' ? item.path : item.path[0]);
              }
            }}
          >
            <Icon path={item.icon} size={1} />
            <span>{item.name}</span>
          </button>
        )
      }
    </nav>
  );
}