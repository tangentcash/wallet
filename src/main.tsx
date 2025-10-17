import "@radix-ui/themes/styles.css";
import './styles/shadows.css';
import './styles/transforms.css';
import './styles/backgrounds.css';
import './styles/transitions.css';
import './styles/breakpoints.css';
import './styles/colors.css';
import BigNumber from "bignumber.js";
import { AppData } from "./core/app";

console.log("%cSTOP! Do not enter any commands you do not understand, your wallet might be at risk.", "font: 2em sans-serif; padding: 6px 12px; color: yellow; border-radius: 8px; background-color: red;");
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: 1 });
AppData.main();