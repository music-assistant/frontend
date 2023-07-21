import {
  Artist,
  BrowseFolder,
  ItemMapping,
  MediaItemType,
  Player,
  PlayerType,
  ProviderMapping,
} from '@/plugins/api/interfaces';

import Color from 'color';
//@ts-ignore
import ColorThief from 'colorthief';
const colorThief = new ColorThief();

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parseBool = (val: string | boolean) => {
  if (val == undefined) return false;
  if (!val) return false;
  if (typeof val === 'boolean') return val;
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
    hoursStr = '0' + hours;
  }
  if (minutes < 10) {
    minutesStr = '0' + minutes;
  }
  if (seconds < 10) {
    secondsStr = '0' + seconds;
  }
  if (hoursStr === '00') {
    return minutesStr + ':' + secondsStr;
  } else {
    return hoursStr + ':' + minutesStr + ':' + secondsStr;
  }
};

export const truncateString = function (str: string, num: number) {
  if (!str) return '';
  // If the length of str is less than or equal to num
  // just return str--don't truncate it.
  if (str.length <= num) {
    return str;
  }
  // Return str truncated with '...' concatenated to the end of str.
  return str.slice(0, num) + '...';
};

export const isColorDark = function (hexColor: string) {
  if (hexColor.includes('var')) {
    hexColor = getComputedStyle(document.documentElement).getPropertyValue(hexColor);
  }
  let r = 0;
  let g = 0;
  let b = 0;
  if (hexColor.includes('rgb(')) {
    const parts = hexColor.split('(')[1].split(')')[0].split(',');
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
    .split('')
    .map((letter, idx) => {
      return letter.toUpperCase() === letter ? `${idx !== 0 ? '-' : ''}${letter.toLowerCase()}` : letter;
    })
    .join('');
};

export const getArtistsString = function (artists: Array<Artist | ItemMapping>, size?: number) {
  if (!artists) return '';
  if (size)
    return artists
      .slice(0, size)
      .map((x) => {
        return x.name;
      })
      .join(' | ');
  return artists
    .map((x) => {
      return x.name;
    })
    .join(' | ');
};

export const getBrowseFolderName = function (browseItem: BrowseFolder, t: any) {
  let browseTitle = '';
  if (browseItem?.name && browseItem?.label) {
    browseTitle = `${browseItem.name}: ${t(browseItem?.label)}`;
  } else if (browseItem?.name) {
    browseTitle = browseItem.name;
  } else if (browseItem?.label) {
    browseTitle = t(browseItem?.label);
  } else {
    browseTitle = browseItem.path || '';
  }
  return browseTitle;
};

export const getPlayerName = function (player: Player, truncate = 26) {
  if (!player) return '';
  if (player.type != PlayerType.GROUP && player.group_childs.length > 1) {
    // create pretty name for syncgroup (e.g. playername +2)
    // TODO: move to API and only count available players
    return `${truncateString(player.display_name, truncate - 3)} +${player.group_childs.length - 1}`;
  }
  return truncateString(player.display_name, truncate);
};

export const getStreamingProviderMappings = function (itemDetails: MediaItemType) {
  const result: ProviderMapping[] = [];
  for (const provider_mapping of itemDetails?.provider_mappings || []) {
    if (provider_mapping.provider_domain.startsWith('filesystem')) continue;
    if (provider_mapping.provider_domain == 'plex') continue;
    if (result.filter((a) => a.provider_domain == provider_mapping.provider_domain).length) continue;
    result.push(provider_mapping);
  }
  return result;
};

export const numberRange = function (start: number, end: number): number[] {
  return Array(end - start + 1)
    .fill(start)
    .map((x, y) => x + y);
};

//Get correct colour
type RGBColor = [number, number, number];

export interface ColorCoverPalette {
  [key: number]: string;
  lightColor: string;
  darkColor: string;
}

export function getContrastingTextColor(hexColor: string): string {
  hexColor = hexColor.replace('#', '');
  if (hexColor.length === 3) {
    hexColor = hexColor
      .split('')
      .map((hex) => hex + hex)
      .join('');
  }

  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.7) {
    return '#000000';
  } else {
    return '#FFFFFF';
  }
}

export function getContrastRatio(color1: string, color2: string): number {
  const c1 = Color(color1);
  const c2 = Color(color2);
  return c1.contrast(c2);
}

export function lightenColor(hexCode: string, factor: number): string {
  if (factor <= 0 || factor > 1) {
    throw new Error('Faktor muss im Bereich von 0 (ausschließlich) bis 1 liegen.');
  }

  const rgbColor: RGBColor = hexToRgb(hexCode);

  const newRgbColor: RGBColor = [
    Math.min(255, Math.round(rgbColor[0] + (255 - rgbColor[0]) * factor)),
    Math.min(255, Math.round(rgbColor[1] + (255 - rgbColor[1]) * factor)),
    Math.min(255, Math.round(rgbColor[2] + (255 - rgbColor[2]) * factor)),
  ];

  return rgbToHex(newRgbColor);
}

export function hexToRgb(hex: string): RGBColor {
  const bigint = parseInt(hex.startsWith('#') ? hex.slice(1) : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

export function rgbToHex(rgb: RGBColor): string {
  const [red, green, blue] = rgb;
  const hex = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue
    .toString(16)
    .padStart(2, '0')}`;
  return hex;
}

export function findLightColor(colors: RGBColor[]): string {
  let mostPleasantColor = '';
  let highestContrastRatio = 0;

  colors.forEach((rgb) => {
    const hexColor = rgbToHex(rgb);
    const contrastRatio = getContrastRatio('#000000', hexColor);

    if (
      (contrastRatio > highestContrastRatio && contrastRatio >= 7) ||
      (contrastRatio > highestContrastRatio && contrastRatio >= highestContrastRatio * 0.7)
    ) {
      highestContrastRatio = contrastRatio;
      mostPleasantColor = hexColor;
    }
  });
  return mostPleasantColor;
}

export function findDarkColor(colors: RGBColor[]): string {
  let mostPleasantColor = '';
  let highestContrastRatio = 0;
  const maxContrastRatio = 17.35;

  colors.forEach((rgb) => {
    const hexColor = rgbToHex(rgb);
    const contrastRatio = getContrastRatio('#fff', hexColor);
    //console.log(`${contrastRatio}:${rgb}`);
    if (maxContrastRatio >= contrastRatio) {
      if (
        (contrastRatio > highestContrastRatio && contrastRatio >= 7) ||
        (contrastRatio > highestContrastRatio && contrastRatio >= highestContrastRatio * 0.7)
      ) {
        highestContrastRatio = contrastRatio;
        mostPleasantColor = hexColor;
      }
    }
  });
  return mostPleasantColor;
}

export function getColorCode(img: HTMLImageElement): ColorCoverPalette {
  const colorThief = new ColorThief();
  const colorNumberPalette: RGBColor[] = colorThief.getPalette(img, 5);
  const colorHexPalette: string[] = colorNumberPalette.map((color) => rgbToHex(color));

  return {
    0: colorHexPalette[0],
    1: colorHexPalette[1],
    2: colorHexPalette[2],
    3: colorHexPalette[3],
    4: colorHexPalette[4],
    lightColor: findLightColor(colorNumberPalette),
    darkColor: findDarkColor(colorNumberPalette),
  };
}

export function getValueFromSources(isAvailabe: any, sources: string | any[]) {
  if (isAvailabe) {
    return isAvailabe;
  }

  for (const element of sources) {
    const source = element;
    const expression = source[0];
    const valueIfTrue = source[1];
    const valueIfFalse = source[2];

    if (expression) {
      return valueIfTrue;
    } else if (valueIfFalse !== undefined) {
      return valueIfFalse;
    }
  }

  return undefined;
}
