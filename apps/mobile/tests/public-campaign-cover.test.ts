import test from "node:test";
import assert from "node:assert/strict";
import { QA_API, TEST_API } from "../src/api/config";
import { publicCampaignCoverSource } from "../src/domain/public-campaign-cover";

const id = "cm_campaign1";
const relative = `/public/campaigns/media/${id}/cover`;
const campaign = { id, status: "PUBLISHED", coverImageUrl: relative };

test("loads the canonical campaign cover through only its configured API, without account auth", () => {
  assert.deepEqual(publicCampaignCoverSource(QA_API, campaign), {
    uri: QA_API + relative, cache: "reload",
  });
  assert.equal(publicCampaignCoverSource(TEST_API, campaign)?.uri, TEST_API + relative);
  assert.equal(publicCampaignCoverSource("http://127.0.0.1:3338", campaign), null);
  assert.equal(
    publicCampaignCoverSource("http://127.0.0.1:3338", campaign, true)?.uri,
    "http://127.0.0.1:3338" + relative,
  );
});

test("does not request a cover when paused, ended, draft, omitted or for a different campaign", () => {
  for (const status of ["PAUSED", "FINISHED", "DRAFT"])
    assert.equal(publicCampaignCoverSource(QA_API, { ...campaign, status }), null);
  for (const coverImageUrl of [undefined, null, "", relative.replace(id, "other_id")])
    assert.equal(publicCampaignCoverSource(QA_API, { ...campaign, coverImageUrl }), null);
});

test("rejects absolute, private, ambiguous or unexpected API and image URLs", () => {
  for (const coverImageUrl of [
    QA_API + relative, "//example.test/image.png", "/api/public/campaign-media/" + id + "/cover",
    "/campaigns/" + id + "/media/cover", relative + "?token=foo", relative + "#image",
    relative.replace(id, ".."), relative.replace(id, "%2F"), relative + "/",
  ]) {
    assert.equal(publicCampaignCoverSource(QA_API, { ...campaign, coverImageUrl }), null);
  }
  for (const api of ["https://example.test", QA_API + "?token=foo", "not an origin"])
    assert.equal(publicCampaignCoverSource(api, campaign), null);
  assert.equal(publicCampaignCoverSource(QA_API, {
    id: "a/b", status: "PUBLISHED", coverImageUrl: "/public/campaigns/media/a/b/cover",
  }), null);
});
