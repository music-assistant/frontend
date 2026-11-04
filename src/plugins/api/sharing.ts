/** Server-resolved public destination for a media item. */
export interface ItemShareLink {
  provider_domain: string;
  provider_instance: string;
  url: string;
}

export interface ItemShareInfo {
  title: string;
  text: string | null;
  links: ItemShareLink[];
}
