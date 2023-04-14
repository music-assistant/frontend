import {
  Artist,
  BrowseFolder,
  ItemMapping,
  MobileDeviceType,
  Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import MobileDetect from 'mobile-detect';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parseBool = (val: string | boolean) => {
  if (val == undefined) return false;
  if (!val) return false;
  if (typeof val === "boolean") return val;
  return !!JSON.parse(String(val).toLowerCase());
};

export const formatDuration = function (totalSeconds: number) {
  totalSeconds = Math.floor(totalSeconds); // round to whole seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
  const seconds = totalSeconds - hours * 3600 - minutes * 60;
  let hoursStr = hours.toString();
  let minutesStr = minutes.toString();
  let secondsStr = seconds.toString();
  if (hours < 10) {
    hoursStr = "0" + hours;
  }
  if (minutes < 10) {
    minutesStr = "0" + minutes;
  }
  if (seconds < 10) {
    secondsStr = "0" + seconds;
  }
  if (hoursStr === "00") {
    return minutesStr + ":" + secondsStr;
  } else {
    return hoursStr + ":" + minutesStr + ":" + secondsStr;
  }
};

export const truncateString = function (str: string, num: number) {
  if (!str) return "";
  // If the length of str is less than or equal to num
  // just return str--don't truncate it.
  if (str.length <= num) {
    return str;
  }
  // Return str truncated with '...' concatenated to the end of str.
  return str.slice(0, num) + "...";
};

export const isColorDark = function (hexColor: string) {
  if (hexColor.includes("var")) {
    hexColor = getComputedStyle(document.documentElement).getPropertyValue(
      hexColor
    );
  }
  let r = 0;
  let g = 0;
  let b = 0;
  if (hexColor.includes("rgb(")) {
    const parts = hexColor.split("(")[1].split(")")[0].split(",");
    r = parseInt(parts[0]);
    g = parseInt(parts[1]);
    b = parseInt(parts[2]);
  } else {
    const c = hexColor.substring(1); // strip #
    const rgb = parseInt(c, 16); // convert rrggbb to decimal
    r = (rgb >> 16) & 0xff; // extract red
    g = (rgb >> 8) & 0xff; // extract green
    b = (rgb >> 0) & 0xff; // extract blue
  }
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

  return luma < 128;
};

export const kebabize = (str: string) => {
  return str
    .split("")
    .map((letter, idx) => {
      return letter.toUpperCase() === letter
        ? `${idx !== 0 ? "-" : ""}${letter.toLowerCase()}`
        : letter;
    })
    .join("");
};

export const getArtistsString = function (
  artists: Array<Artist | ItemMapping>
) {
  if (!artists) return "";
  return artists
    .map((x) => {
      return x.name;
    })
    .join(" / ");
};

export const getBrowseFolderName = function (browseItem: BrowseFolder, t: any) {
  let browseTitle = "";
  if (browseItem?.name && browseItem?.label) {
    browseTitle = `${browseItem.name}: ${t(browseItem?.label)}`;
  } else if (browseItem?.name) {
    browseTitle = browseItem.name;
  } else if (browseItem?.label) {
    browseTitle = t(browseItem?.label);
  } else {
    browseTitle = browseItem.path || "";
  }
  return browseTitle;
};

export const getPlayerName = function (player: Player, truncate: number = 26) {
  if (!player) return '';
  if (player.type != PlayerType.GROUP && player.group_childs.length > 0) {
    // create pretty name for syncgroup (e.g. playername +2)
    // TODO: move to APi and only count available players
    return `${truncateString(
      player.display_name,
      truncate - 3
    )} +${player.group_childs.length}`;
  }
  return truncateString(player.display_name, truncate);
};

export const numberRange = function (start: number, end: number): number[] {
  return Array(end - start + 1).fill(start).map((x, y) => x + y);
}

//Is in the process of calibration. A sorting of the values is therefore pending.
export const getResponsiveBreakpoints = {
  breakpoint_1: 575,
  breakpoint_2: 715,
  breakpoint_3: 960,
  breakpoint_4: 1100,
  breakpoint_5: 1500,
  breakpoint_6: 1700,
  breakpoint_7: 800,
  breakpoint_8: 375,
  breakpoint_9: 1900,
  breakpoint_10: 540,
};

const md = new MobileDetect(window.navigator.userAgent);

export const isMobileDevice = (device: MobileDeviceType, displaySize: {
  height: number;
  width: number;
}) => {
  if (device == MobileDeviceType.ALL) {
    return md.mobile()
    ? true
    : displaySize.width < getResponsiveBreakpoints.breakpoint_1;
  }
  if (device == MobileDeviceType.PHONE) {
    return md.phone()
    ? true
    : displaySize.width < getResponsiveBreakpoints.breakpoint_1;
  }
  if (device == MobileDeviceType.TABLET) {
    return md.tablet()
    ? true
    : displaySize.width < getResponsiveBreakpoints.breakpoint_1;
  }
};
