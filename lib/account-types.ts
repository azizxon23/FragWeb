export type Profile = {
  id: string;
  displayName: string;
  phone: string;
  telegram: string;
  city: string;
  bio: string;
  email: string;
  status: string;
  createdAt: number;
  updatedAt: number;
};
export type AccountData = { profile: Profile | null; isAdmin: boolean };
export type PublicProfile = Pick<
  Profile,
  "id" | "displayName" | "telegram" | "city" | "bio" | "createdAt"
> & { listingCount: number };
export type ApiHeaders = () => Record<string, string>;
