"use strict";

const {
  computeBadges,
  mapProjectRow,
  mapDonationRow,
  mapProfileRow,
  mapProjectUpdateRow,
  mapJobRow,
  mapProjectMilestoneRow,
  mapProjectRatingRow,
} = require("./store");

describe("store utility functions", () => {
  test("computeBadges returns no badge below 10 XLM", () => {
    expect(computeBadges(9)).toEqual([]);
  });

  test("computeBadges returns seedling badge at 10 XLM", () => {
    expect(computeBadges(10)[0]).toMatchObject({ tier: "seedling" });
  });

  test("computeBadges returns highest earned badge", () => {
    expect(computeBadges(2000)[0]).toMatchObject({ tier: "earth" });
  });

  test("mapProjectRow maps database project fields to API fields", () => {
    const row = {
      id: "project-1",
      name: "Clean Energy",
      description: "Solar project",
      category: "Solar",
      location: "India",
      wallet_address: "GABC",
      goal_xlm: 100,
      raised_xlm: 25,
      donor_count: 3,
      co2_offset_kg: 500,
      status: "active",
      verified: true,
      on_chain_verified: false,
      tags: ["solar"],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };

    expect(mapProjectRow(row)).toMatchObject({
      id: "project-1",
      walletAddress: "GABC",
      goalXLM: "100",
      raisedXLM: "25",
      tags: ["solar"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  test("mapDonationRow includes formatted amountXLM when present", () => {
    const row = {
      id: "donation-1",
      project_id: "project-1",
      donor_address: "GDONOR",
      amount: 12.5,
      amount_xlm: 12.5,
      currency: "XLM",
      message: "Great work",
      transaction_hash: "abc123",
      created_at: "2026-01-01T00:00:00.000Z",
    };

    expect(mapDonationRow(row)).toMatchObject({
      projectId: "project-1",
      donorAddress: "GDONOR",
      amount: "12.5",
      amountXLM: "12.5000000",
      currency: "XLM",
    });
  });

  test("mapDonationRow omits amountXLM when not present", () => {
    const result = mapDonationRow({
      id: "donation-1",
      project_id: "project-1",
      donor_address: "GDONOR",
      amount: 20,
      amount_xlm: null,
      currency: "USD",
      message: null,
      transaction_hash: null,
      created_at: null,
    });

    expect(result.amountXLM).toBeUndefined();
  });

  test("mapProfileRow maps profile fields", () => {
    expect(
      mapProfileRow({
        public_key: "GUSER",
        display_name: "Asraf",
        bio: "Donor",
        total_donated_xlm: 100,
        projects_supported: 2,
        badges: [{ tier: "tree" }],
        created_at: null,
        updated_at: null,
      })
    ).toMatchObject({
      publicKey: "GUSER",
      displayName: "Asraf",
      totalDonatedXLM: "100",
      projectsSupported: 2,
      badges: [{ tier: "tree" }],
      createdAt: null,
      updatedAt: null,
    });
  });

  test("row mappers convert snake_case fields to camelCase", () => {
    expect(
      mapProjectUpdateRow({
        id: "update-1",
        project_id: "project-1",
        title: "Update",
        body: "Body",
        created_at: null,
      })
    ).toMatchObject({ projectId: "project-1" });

    expect(
      mapJobRow({
        id: "job-1",
        title: "Job",
        description: "Desc",
        client_public_key: "GCLIENT",
        freelancer_public_key: "GFREELANCER",
        amount_escrow_xlm: 50,
        status: "open",
        release_transaction_hash: null,
        created_at: null,
        updated_at: null,
      })
    ).toMatchObject({
      clientPublicKey: "GCLIENT",
      freelancerPublicKey: "GFREELANCER",
      amountEscrowXlm: "50",
    });

    expect(
      mapProjectMilestoneRow({
        id: "milestone-1",
        project_id: "project-1",
        percentage: 50,
        title: "Halfway",
        reached_at: null,
        transaction_hash: "tx123",
        created_at: null,
      })
    ).toMatchObject({
      projectId: "project-1",
      transactionHash: "tx123",
    });

    expect(
      mapProjectRatingRow({
        id: "rating-1",
        project_id: "project-1",
        donor_address: "GDONOR",
        rating: 5,
        review: "Good",
        created_at: null,
      })
    ).toMatchObject({
      projectId: "project-1",
      donorAddress: "GDONOR",
    });
  });
});