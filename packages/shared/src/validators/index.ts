import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid phone number (E.164 format)");

export const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1, "Street address required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City required"),
  state: z.string().length(2, "Two-letter state code"),
  postalCode: z.string().min(5, "ZIP code required"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const mobilitySchema = z.enum([
  "ambulatory",
  "wheelchair",
  "wheelchair_power",
  "stretcher",
  "bariatric",
]);

export const payerTypeSchema = z.enum([
  "private_pay",
  "medicaid",
  "medicare",
  "mco",
  "waiver_program",
  "va",
  "workers_comp",
  "facility_billed",
]);

export const bookTripSchema = z
  .object({
    patientId: z.string().uuid(),
    tripType: z.enum(["one_way", "round_trip", "will_call_return"]),
    scheduledPickupAt: z.coerce.date(),
    appointmentAt: z.coerce.date().optional(),
    returnPickupAt: z.coerce.date().optional(),
    pickupAddressId: z.string().uuid(),
    dropoffAddressId: z.string().uuid(),
    mobility: mobilitySchema,
    needsAttendant: z.boolean().default(false),
    needsOxygen: z.boolean().default(false),
    passengerCount: z.number().int().min(1).max(6).default(1),
    specialInstructions: z.string().max(1000).optional(),
    payerType: payerTypeSchema,
    insuranceProfileId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // Future-date only. Allow +15 min minimum lead time.
      const minLead = new Date(Date.now() + 15 * 60 * 1000);
      return data.scheduledPickupAt >= minLead;
    },
    { message: "Pickup must be at least 15 minutes from now", path: ["scheduledPickupAt"] },
  )
  .refine(
    (data) => data.pickupAddressId !== data.dropoffAddressId,
    { message: "Pickup and drop-off must differ", path: ["dropoffAddressId"] },
  )
  .refine(
    (data) =>
      data.tripType !== "round_trip" || data.returnPickupAt !== undefined,
    { message: "Round trip requires a return pickup time", path: ["returnPickupAt"] },
  );

export type BookTripInput = z.infer<typeof bookTripSchema>;

export const recurringScheduleSchema = z.object({
  patientId: z.string().uuid(),
  label: z.string().min(1).max(80),
  pickupAddressId: z.string().uuid(),
  dropoffAddressId: z.string().uuid(),
  pickupTimeLocal: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
  timezone: z.string().default("America/New_York"),
  mobility: mobilitySchema,
  tripType: z.enum(["one_way", "round_trip"]).default("round_trip"),
  returnPickupTimeLocal: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  payerType: payerTypeSchema,
  insuranceProfileId: z.string().uuid().optional(),
});

export type RecurringScheduleInput = z.infer<typeof recurringScheduleSchema>;

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: phoneSchema.optional(),
  role: z.enum(["rider", "family"]).default("rider"),
});

export type SignupInput = z.infer<typeof signupSchema>;
