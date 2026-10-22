export const parseBool = (val: string | boolean | undefined | null) => {
  if (val == undefined || val == null) return false;
  if (!val) return false;
  if (typeof val === "boolean") return val;
  return !!JSON.parse(String(val).toLowerCase());
};
