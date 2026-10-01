/**
 * Neutral read-time label for a person or member with no usable name. Shown only;
 * never written to a Person, profile, or snapshot. The database resolves names with
 * private.member_display_name_v1 (linked Person name, then profile name).
 */
export const MEMBER_NAME_NOT_SET = "Name not set";
