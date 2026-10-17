import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard, transaction } from "@/lib/api/db";
import { conflict, notFound, validation } from "@/lib/api/errors";
import {
  Body,
  list,
  normalizeRateType,
  optional,
  Optional,
  page,
  RateType,
  requireBool,
  requireDecimal,
  requireName,
  requireString,
  roundMoney,
} from "@/lib/api/json";
import { prisma } from "@/lib/prisma";

function rateJson(rate: {
  id: string;
  organizationId: string;
  type: string;
  name: string;
  perHourRate: Prisma.Decimal;
  isDefault: boolean;
  isArchived: boolean;
}) {
  return {
    id: rate.id,
    organizationId: rate.organizationId,
    type: rate.type,
    name: rate.name,
    perHourRate: Number(rate.perHourRate),
    isDefault: rate.isDefault,
    isArchived: rate.isArchived,
  };
}

export function seedDefaultHourlyRate(organizationId: string) {
  return {
    organizationId,
    type: "Volunteer" as const,
    name: "Volunteer",
    perHourRate: 35.47,
    isDefault: true,
    isArchived: false,
  };
}

export async function defaultVolunteerRate(organizationId: string) {
  const rate = await prisma.hourlyRate.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (!rate) {
    validation("This organization needs a default volunteer rate.");
  }

  return { id: rate.id, rate: Number(rate.perHourRate) };
}

export type CreateHourlyRateRequest = {
  type: RateType;
  name: string;
  perHourRate: number;
  isDefault: boolean;
  isArchived: boolean;
};

export function parseCreateHourlyRate(body: Body): CreateHourlyRateRequest {
  const type = normalizeRateType(requireString(body, "type"));
  const name = requireName(requireString(body, "name"));
  const perHourRate = roundMoney(requireDecimal(body, "perHourRate"));
  if (perHourRate <= 0) {
    validation("perHourRate must be greater than zero.");
  }

  const isDefault = body.isDefault === true;
  const isArchived = body.isArchived === true;
  if (isDefault && type !== "Volunteer") {
    validation("Only a volunteer rate can be the default.");
  }

  if (isDefault && isArchived) {
    validation("The default volunteer rate cannot be archived.");
  }

  return { type, name, perHourRate, isDefault, isArchived };
}

export type UpdateHourlyRateRequest = {
  type: Optional<RateType>;
  name: Optional<string>;
  perHourRate: Optional<number>;
  isDefault: Optional<boolean>;
  isArchived: Optional<boolean>;
};

export function parseUpdateHourlyRate(body: Body): UpdateHourlyRateRequest {
  const request: UpdateHourlyRateRequest = {
    type: optional(body, "type", (b, k) => normalizeRateType(requireString(b, k))),
    name: optional(body, "name", (b, k) => requireName(requireString(b, k))),
    perHourRate: optional(body, "perHourRate", (b, k) => {
      const rate = roundMoney(requireDecimal(b, k));
      if (rate <= 0) {
        validation("perHourRate must be greater than zero.");
      }

      return rate;
    }),
    isDefault: optional(body, "isDefault", requireBool),
    isArchived: optional(body, "isArchived", requireBool),
  };
  if (
    !request.type.set &&
    !request.name.set &&
    !request.perHourRate.set &&
    !request.isDefault.set &&
    !request.isArchived.set
  ) {
    validation("Provide at least one field to update.");
  }

  return request;
}

export async function listHourlyRates(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const rates = await prisma.hourlyRate.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { type: "asc" }, { name: "asc" }],
    skip: paging.offset,
    take: paging.limit,
  });
  return list(rates.map(rateJson), paging);
}

async function managed(access: Access, rateId: string) {
  const rate = await prisma.hourlyRate.findUnique({ where: { id: rateId } });
  if (!rate) {
    notFound();
  }

  await access.requireOrganization(rate.organizationId, true);
  return rate;
}

async function clearDefault(tx: Prisma.TransactionClient, organizationId: string, exceptRateId?: string) {
  await tx.hourlyRate.updateMany({
    where: { organizationId, isDefault: true, ...(exceptRateId ? { id: { not: exceptRateId } } : {}) },
    data: { isDefault: false },
  });
}

export async function createHourlyRate(access: Access, organizationId: string, request: CreateHourlyRateRequest) {
  await access.requireOrganization(organizationId, true);
  return rateJson(
    await transaction(async (tx) => {
      if (request.isDefault) {
        await clearDefault(tx, organizationId);
      }

      return guard(
        tx.hourlyRate.create({
          data: {
            organizationId,
            type: request.type,
            name: request.name,
            perHourRate: request.perHourRate,
            isDefault: request.isDefault,
            isArchived: request.isArchived,
          },
        }),
      );
    }),
  );
}

export async function updateHourlyRate(access: Access, rateId: string, request: UpdateHourlyRateRequest) {
  const rate = await managed(access, rateId);
  return rateJson(
    await transaction(async (tx) => {
      const type = request.type.set ? request.type.value : rate.type;
      const isDefault = request.isDefault.set ? request.isDefault.value : rate.isDefault;
      const isArchived = request.isArchived.set ? request.isArchived.value : rate.isArchived;
      if (isDefault && type !== "Volunteer") {
        validation("Only a volunteer rate can be the default.");
      }

      if (isDefault && isArchived) {
        validation("The default volunteer rate cannot be archived.");
      }

      if (rate.isDefault && !isDefault) {
        validation("Choose another default volunteer rate first.");
      }

      if (isDefault && !rate.isDefault) {
        await clearDefault(tx, rate.organizationId, rate.id);
      }

      return guard(
        tx.hourlyRate.update({
          where: { id: rate.id },
          data: {
            type,
            name: request.name.set ? request.name.value : undefined,
            perHourRate: request.perHourRate.set ? request.perHourRate.value : undefined,
            isDefault,
            isArchived,
          },
        }),
      );
    }),
  );
}

export async function deleteHourlyRate(access: Access, rateId: string) {
  const rate = await managed(access, rateId);
  if (rate.isDefault) {
    conflict("The default volunteer rate cannot be deleted.");
  }

  const referenced =
    (await prisma.userTimeEntry.count({ where: { hourlyRateId: rate.id } })) > 0 ||
    (await prisma.collectiveTimeEntry.count({ where: { hourlyRateId: rate.id } })) > 0;
  if (referenced) {
    conflict("Archive this rate instead. Time entries still use it.");
  }

  await guard(prisma.hourlyRate.delete({ where: { id: rate.id } }));
}
