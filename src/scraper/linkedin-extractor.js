
/* oxlint-disable eslint/no-unused-vars, unicorn/no-new-array, eslint/prefer-const */

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* =========================================================
   CONFIG
   ========================================================= */

const SCROLL_CONFIG = {
  mainProfile: {
    step: 650,
    delayMs: 1600,
    bottomWaitMs: 2500,
    stableBottomRounds: 2,
    maxSteps: 50,
  },

  detailPage: {
    step: 600,
    delayMs: 1800,
    bottomWaitMs: 2500,
    stableBottomRounds: 2,
    maxSteps: 60,
  },

  skills: {
    step: 500,
    delayMs: 2800,
    bottomWaitMs: 4000,
    stableBottomRounds: 3,
    maxSteps: 120,
  },
};

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

export function clean(value) {
  if (!value) {
    return null;
  }

  const result = value
    .replace(/\u200b/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  return result || null;
}

export function normalize(value) {
  return clean(value)?.toLowerCase() || "";
}

export function lines(text) {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .filter((line) => line !== "·");
}

export function isDateRange(value) {
  if (!value) {
    return false;
  }

  return /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{4}\s*[-–]\s*(?:present|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{4})/i.test(
    value
  );
}

export function isSingleExperienceDate(value) {
  if (!value) {
    return false;
  }

  return /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{4}(?:\s*·\s*\d+\s+(?:mo|mos|yr|yrs|wk|wks|day|days))?$/i.test(
    value.trim()
  );
}

function isExperienceDate(value) {
  return (
    isDateRange(value) ||
    isSingleExperienceDate(value)
  );
}

export function splitDateDuration(value) {
  if (!value) {
    return {
      dateRange: null,
      duration: null,
    };
  }

  const parts = value
    .split("·")
    .map(clean)
    .filter(Boolean);

  return {
    dateRange: parts[0] || null,
    duration: parts[1] || null,
  };
}

function looksLikeEmploymentMeta(value) {
  if (!value) {
    return false;
  }

  return /(full-time|part-time|contract|self-employed|freelance|internship|apprenticeship|seasonal)/i.test(
    value
  );
}

export function extractEmploymentType(value) {
  if (!value) {
    return null;
  }

  const pieces = value
    .split("·")
    .map(clean)
    .filter(Boolean);

  return (
    pieces.find(
      looksLikeEmploymentMeta
    ) || null
  );
}

export function extractOrganizationFromMeta(value) {
  if (!value) {
    return null;
  }

  const pieces = value
    .split("·")
    .map(clean)
    .filter(Boolean);

  if (!pieces.length) {
    return null;
  }

  return pieces[0] || null;
}

function looksLikeExplicitWorkLocation(value) {
  if (!value) {
    return false;
  }

  return /(?:hybrid|remote|on-site|onsite)$/i.test(
    value.trim()
  );
}

function isPronouns(value) {
  if (!value) {
    return false;
  }

  return /^(he\/him|she\/her|they\/them|he\/they|she\/they)$/i.test(
    value
  );
}

function isConnectionDegree(value) {
  if (!value) {
    return false;
  }

  return /^·?\s*(?:1st|2nd|3rd\+?)$/i.test(
    value.trim()
  );
}

function extractCount(text, suffix) {
  if (!text) {
    return null;
  }

  const regex =
    new RegExp(
      `([\\d,.+]+)\\s+${suffix}`,
      "i"
    );

  return (
    text.match(regex)?.[1] ||
    null
  );
}

function uniqueBy(items, keyFn) {
  const seen = new Set();

  return items.filter((item) => {
    const key = keyFn(item);

    if (
      !key ||
      seen.has(key)
    ) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function getBaseUrl(profileUrl) {
  const url =
    new URL(profileUrl);

  const match =
    url.pathname.match(
      /^\/in\/[^/]+/
    );

  if (!match) {
    throw new Error(
      "Invalid LinkedIn profile URL"
    );
  }

  return `${url.origin}${match[0]}`;
}

function isLinkedInOrganizationUrl(
  href
) {
  if (!href) {
    return false;
  }

  return (
    href.includes(
      "linkedin.com/company/"
    ) ||
    href.includes(
      "linkedin.com/school/"
    )
  );
}

function canonicalLinkedInEntityUrl(
  href
) {
  if (!href) {
    return null;
  }

  try {
    const url =
      new URL(href);

    const pathname =
      url.pathname.replace(
        /\/+$/,
        ""
      );

    return `${url.origin}${pathname}/`;
  } catch {
    return href;
  }
}

/* =========================================================
   BROWSER
   ========================================================= */

async function findMainProfilePage(
  context,
  timeoutMs = 60000
) {
  const start =
    Date.now();

  while (
    Date.now() - start <
    timeoutMs
  ) {
    const page =
      context.pages().find(
        (p) =>
          /^https:\/\/www\.linkedin\.com\/in\/[^/]+\/?$/i.test(
            p.url()
          )
      );

    if (page) {
      return page;
    }

    console.log(
      "Waiting for main LinkedIn profile..."
    );

    await sleep(2000);
  }

  throw new Error(
    "Main LinkedIn profile not found."
  );
}

async function navigateLinkedIn(
  page,
  url,
  retryCount = 0
) {
  try {
    await page.goto(url, {
      waitUntil: "commit",
      timeout: 30000,
    });
  } catch (error) {
    let requested;
    let current;

    try {
      requested =
        new URL(url);

      current =
        new URL(
          page.url()
        );
    } catch {
      throw error;
    }

    if (
      current.pathname !==
      requested.pathname
    ) {
      if (
        retryCount < 1 &&
        (
          error.name ===
            "TimeoutError" ||
          /ERR_(?:CONNECTION_CLOSED|CONNECTION_RESET|NETWORK_CHANGED)/i.test(
            error.message
          )
        )
      ) {
        await sleep(1000);

        return navigateLinkedIn(
          page,
          url,
          retryCount + 1
        );
      }

      throw error;
    }

    console.log(
      "Navigation timed out, but target URL was reached. Continuing..."
    );
  }

  await page
    .locator("main")
    .waitFor({
      state: "attached",
      timeout: 20000,
    });

  await sleep(2500);
}

/* =========================================================
   SCROLL CONTAINER DETECTION
   ========================================================= */

async function detectScrollContainer(
  page
) {
  return page.evaluate(() => {
    document
      .querySelectorAll(
        "[data-linkedin-scroll-root]"
      )
      .forEach((el) =>
        el.removeAttribute(
          "data-linkedin-scroll-root"
        )
      );

    const main =
      document.querySelector(
        "main"
      );

    if (!main) {
      return null;
    }

    const candidates =
      Array.from(
        document.querySelectorAll("*")
      )
        .map((el) => {
          const style =
            window.getComputedStyle(
              el
            );

          const overflowY =
            style.overflowY;

          const scrollHeight =
            el.scrollHeight;

          const clientHeight =
            el.clientHeight;

          const scrollDistance =
            scrollHeight -
            clientHeight;

          const relevantToMain =
            el === main ||
            el.contains(main);

          return {
            el,
            tag: el.tagName,
            overflowY,
            scrollHeight,
            clientHeight,
            scrollDistance,
            relevantToMain,
          };
        })
        .filter(
          (item) =>
            item.relevantToMain &&
            item.scrollDistance >
              100 &&
            (
              item.overflowY ===
                "auto" ||
              item.overflowY ===
                "scroll"
            )
        )
        .sort(
          (a, b) =>
            b.scrollDistance -
            a.scrollDistance
        );

    if (!candidates.length) {
      return null;
    }

    const winner =
      candidates[0];

    winner.el.setAttribute(
      "data-linkedin-scroll-root",
      "true"
    );

    return {
      tag:
        winner.tag,

      overflowY:
        winner.overflowY,

      scrollHeight:
        winner.scrollHeight,

      clientHeight:
        winner.clientHeight,

      scrollDistance:
        winner.scrollDistance,
    };
  });
}

/* =========================================================
   DOCUMENT SCROLL FALLBACK
   ========================================================= */

async function hydrateDocumentScroll(
  page,
  config,
  label
) {
  const {
    step,
    delayMs,
    bottomWaitMs,
    stableBottomRounds,
    maxSteps,
  } = config;

  console.log(
    `${label}: using document scrolling fallback`
  );

  const initial =
    await page.evaluate(() => {
      const el =
        document.scrollingElement;

      if (!el) {
        return null;
      }

      el.setAttribute(
        "data-document-scroll-root",
        "true"
      );

      el.scrollTop = 0;

      return {
        scrollHeight:
          el.scrollHeight,

        clientHeight:
          el.clientHeight,
      };
    });

  if (!initial) {
    return;
  }

  let stableRounds = 0;

  let previousHeight =
    initial.scrollHeight;

  let previousMainLength =
    await page.evaluate(
      () =>
        document.querySelector(
          "main"
        )?.innerText.length ||
        0
    );

  for (
    let i = 0;
    i < maxSteps;
    i++
  ) {
    await page.evaluate(
      (amount) => {
        const el =
          document.querySelector(
            "[data-document-scroll-root]"
          );

        if (el) {
          el.scrollTop +=
            amount;
        }
      },
      step
    );

    await sleep(delayMs);

    const state =
      await page.evaluate(() => {
        const el =
          document.querySelector(
            "[data-document-scroll-root]"
          );

        if (!el) {
          return null;
        }

        return {
          top:
            el.scrollTop,

          scrollHeight:
            el.scrollHeight,

          clientHeight:
            el.clientHeight,

          mainLength:
            document.querySelector(
              "main"
            )?.innerText.length ||
            0,
        };
      });

    if (!state) {
      break;
    }

    const atBottom =
      state.top +
        state.clientHeight >=
      state.scrollHeight -
        100;

    if (
      label
        .toLowerCase()
        .includes("skills")
    ) {
      console.log(
        `[${label} ${i + 1}] top=${Math.round(
          state.top
        )} height=${state.scrollHeight} text=${state.mainLength}`
      );
    }

    if (!atBottom) {
      stableRounds = 0;

      previousHeight =
        state.scrollHeight;

      previousMainLength =
        state.mainLength;

      continue;
    }

    await sleep(
      bottomWaitMs
    );

    const waited =
      await page.evaluate(() => {
        const el =
          document.querySelector(
            "[data-document-scroll-root]"
          );

        if (!el) {
          return null;
        }

        return {
          top:
            el.scrollTop,

          scrollHeight:
            el.scrollHeight,

          clientHeight:
            el.clientHeight,

          mainLength:
            document.querySelector(
              "main"
            )?.innerText.length ||
            0,
        };
      });

    if (!waited) {
      break;
    }

    const hydrated =
      waited.scrollHeight >
        previousHeight ||
      waited.mainLength >
        previousMainLength;

    previousHeight =
      waited.scrollHeight;

    previousMainLength =
      waited.mainLength;

    if (hydrated) {
      console.log(
        `${label}: new batch hydrated — continuing`
      );

      stableRounds = 0;

      continue;
    }

    stableRounds++;

    console.log(
      `${label}: bottom stable ${stableRounds}/${stableBottomRounds}`
    );

    if (
      stableRounds >=
      stableBottomRounds
    ) {
      break;
    }
  }

  await sleep(
    bottomWaitMs
  );

  await page.evaluate(() => {
    const el =
      document.querySelector(
        "[data-document-scroll-root]"
      );

    if (el) {
      el.scrollTop = 0;
    }
  });

  await sleep(700);
}

/* =========================================================
   INTERNAL SCROLL HYDRATION
   ========================================================= */

async function hydrateScroll(
  page,
  config,
  label = "page"
) {
  const {
    step,
    delayMs,
    bottomWaitMs,
    stableBottomRounds,
    maxSteps,
  } = config;

  console.log(
    `Hydrating ${label} with slow scrolling...`
  );

  let scrollInfo =
    await detectScrollContainer(
      page
    );

  if (!scrollInfo) {
    console.log(
      `${label}: no nested scroll container found`
    );

    await hydrateDocumentScroll(
      page,
      config,
      label
    );

    return;
  }

  console.log(
    `${label}: scroll container detected`
  );

  console.log({
    tag:
      scrollInfo.tag,

    overflowY:
      scrollInfo.overflowY,

    clientHeight:
      scrollInfo.clientHeight,

    scrollHeight:
      scrollInfo.scrollHeight,

    scrollDistance:
      scrollInfo.scrollDistance,
  });

  await page.evaluate(() => {
    const scroller =
      document.querySelector(
        "[data-linkedin-scroll-root]"
      );

    if (scroller) {
      scroller.scrollTop = 0;
    }
  });

  await sleep(1000);

  let stableRounds = 0;

  let previousHeight =
    scrollInfo.scrollHeight;

  let previousMainLength =
    await page.evaluate(
      () =>
        document.querySelector(
          "main"
        )?.innerText.length ||
        0
    );

  for (
    let iteration = 0;
    iteration < maxSteps;
    iteration++
  ) {
    const markerExists =
      await page.evaluate(
        () =>
          Boolean(
            document.querySelector(
              "[data-linkedin-scroll-root]"
            )
          )
      );

    if (!markerExists) {
      scrollInfo =
        await detectScrollContainer(
          page
        );

      if (!scrollInfo) {
        break;
      }
    }

    await page.evaluate(
      (amount) => {
        const scroller =
          document.querySelector(
            "[data-linkedin-scroll-root]"
          );

        if (scroller) {
          scroller.scrollTop +=
            amount;
        }
      },
      step
    );

    await sleep(delayMs);

    const state =
      await page.evaluate(() => {
        const scroller =
          document.querySelector(
            "[data-linkedin-scroll-root]"
          );

        if (!scroller) {
          return null;
        }

        return {
          top:
            scroller.scrollTop,

          scrollHeight:
            scroller.scrollHeight,

          clientHeight:
            scroller.clientHeight,

          mainLength:
            document.querySelector(
              "main"
            )?.innerText.length ||
            0,
        };
      });

    if (!state) {
      scrollInfo =
        await detectScrollContainer(
          page
        );

      if (!scrollInfo) {
        break;
      }

      continue;
    }

    const atBottom =
      state.top +
        state.clientHeight >=
      state.scrollHeight -
        100;

    if (
      label
        .toLowerCase()
        .includes("skills")
    ) {
      console.log(
        `[${label} ${
          iteration + 1
        }] top=${Math.round(
          state.top
        )} height=${state.scrollHeight} text=${state.mainLength}`
      );
    }

    if (!atBottom) {
      stableRounds = 0;

      previousHeight =
        state.scrollHeight;

      previousMainLength =
        state.mainLength;

      continue;
    }

    await sleep(
      bottomWaitMs
    );

    const waited =
      await page.evaluate(() => {
        const scroller =
          document.querySelector(
            "[data-linkedin-scroll-root]"
          );

        if (!scroller) {
          return null;
        }

        return {
          top:
            scroller.scrollTop,

          scrollHeight:
            scroller.scrollHeight,

          clientHeight:
            scroller.clientHeight,

          mainLength:
            document.querySelector(
              "main"
            )?.innerText.length ||
            0,
        };
      });

    if (!waited) {
      scrollInfo =
        await detectScrollContainer(
          page
        );

      if (!scrollInfo) {
        break;
      }

      continue;
    }

    const hydrated =
      waited.scrollHeight >
        previousHeight ||
      waited.mainLength >
        previousMainLength;

    previousHeight =
      waited.scrollHeight;

    previousMainLength =
      waited.mainLength;

    if (hydrated) {
      console.log(
        `${label}: new batch hydrated — continuing`
      );

      stableRounds = 0;

      continue;
    }

    stableRounds++;

    console.log(
      `${label}: bottom stable ${stableRounds}/${stableBottomRounds}`
    );

    if (
      stableRounds >=
      stableBottomRounds
    ) {
      break;
    }
  }

  await sleep(
    bottomWaitMs
  );

  const final =
    await page.evaluate(() => {
      const scroller =
        document.querySelector(
          "[data-linkedin-scroll-root]"
        );

      return {
        top:
          scroller?.scrollTop ||
          0,

        scrollHeight:
          scroller?.scrollHeight ||
          0,

        mainLength:
          document.querySelector(
            "main"
          )?.innerText.length ||
          0,
      };
    });

  console.log(
    `${label} hydration complete — top=${final.top}, scrollHeight=${final.scrollHeight}, mainText=${final.mainLength}`
  );

  await page.evaluate(() => {
    const scroller =
      document.querySelector(
        "[data-linkedin-scroll-root]"
      );

    if (scroller) {
      scroller.scrollTop = 0;
    }
  });

  await sleep(700);
}

/* =========================================================
   SECTION COLLECTION
   ========================================================= */

async function collectSections(
  page
) {
  return page
    .locator("section")
    .evaluateAll((elements) =>
      elements
        .map(
          (
            section,
            index
          ) => {
            const headings =
              Array.from(
                section.querySelectorAll(
                  "h1,h2,h3,h4,[role='heading']"
                )
              )
                .map((el) =>
                  el.innerText
                    ?.replace(
                      /\s+/g,
                      " "
                    )
                    .trim()
                )
                .filter(Boolean);

            const links =
              Array.from(
                section.querySelectorAll(
                  "a[href]"
                )
              )
                .map((a) => ({
                  text:
                    a.innerText
                      ?.trim() ||
                    null,

                  href:
                    a.href ||
                    null,
                }))
                .filter(
                  (link) =>
                    link.text ||
                    link.href
                );

            const images =
              Array.from(
                section.querySelectorAll(
                  "img"
                )
              )
                .map((img) => ({
                  alt:
                    img.alt ||
                    null,

                  src:
                    img.currentSrc ||
                    img.src ||
                    null,

                  width:
                    img.naturalWidth ||
                    null,

                  height:
                    img.naturalHeight ||
                    null,
                }))
                .filter(
                  (img) =>
                    img.src
                );

            return {
              index,

              primaryHeading:
                headings[0] ||
                null,

              headings,

              text:
                section.innerText
                  ?.trim() ||
                "",

              links,

              images,
            };
          }
        )
        .filter(
          (section) =>
            section.text.length >
            0
        )
    );
}

function getMainSection(
  sections,
  heading
) {
  const target =
    heading.toLowerCase();

  return (
    sections.find(
      (section) => {
        const h =
          section.primaryHeading
            ?.toLowerCase();

        return (
          h === target ||
          h?.startsWith(
            `${target} (`
          )
        );
      }
    ) || null
  );
}

/* =========================================================
   HEADER
   ========================================================= */

function findHeaderSection(
  sections,
  expectedName
) {
  const normalizedName =
    normalize(
      expectedName
    );

  const candidates =
    sections.filter(
      (section) => {
        const heading =
          normalize(
            section.primaryHeading
          );

        const hasCorrectName =
          heading ===
          normalizedName;

        const hasContactInfo =
          /\bContact info\b/i.test(
            section.text
          );

        const hasLargeImage =
          section.images.some(
            (img) =>
              img.src?.includes(
                "profile-displayphoto"
              ) &&
              (img.width || 0) >=
                200
          );

        return (
          hasCorrectName &&
          hasContactInfo &&
          hasLargeImage
        );
      }
    );

  candidates.sort(
    (a, b) =>
      a.text.length -
      b.text.length
  );

  return candidates[0] || null;
}

export function parseHeader(
  section,
  url
) {
  if (!section) {
    return {};
  }

  const data =
    lines(
      section.text
    );

  const name =
    section.primaryHeading ||
    data[0];

  let index =
    data.findIndex(
      (line) =>
        line === name
    ) + 1;

  let pronouns =
    null;

  if (
    isPronouns(
      data[index]
    )
  ) {
    pronouns =
      data[index++];
  }

  while (
    index <
      data.length &&
    isConnectionDegree(
      data[index]
    )
  ) {
    index++;
  }

  const headline =
    data[index++] ||
    null;

  let location =
    null;

  while (
    index <
    data.length
  ) {
    const value =
      data[index];

    if (
      /^contact info$/i.test(
        value
      )
    ) {
      break;
    }

    if (
      isConnectionDegree(
        value
      ) ||
      /followers|connections/i.test(
        value
      )
    ) {
      index++;

      continue;
    }

    location =
      value;

    break;
  }

  const contactIndex =
    data.findIndex(
      (line) =>
        /^contact info$/i.test(
          line
        )
    );

  let currentCompany =
    null;

  if (
    contactIndex >= 0
  ) {
    for (
      let i =
        contactIndex + 1;
      i < data.length;
      i++
    ) {
      const value =
        data[i];

      if (
        !value ||
        isConnectionDegree(
          value
        ) ||
        /followers|connections/i.test(
          value
        )
      ) {
        continue;
      }

      currentCompany =
        value;

      break;
    }
  }

  const profileImage =
    section.images.find(
      (img) =>
        img.src?.includes(
          "profile-displayphoto"
        ) &&
        (img.width || 0) >=
          200
    )?.src || null;

  const coverImage =
    section.images.find(
      (img) =>
        img.src?.includes(
          "profile-displaybackgroundimage"
        )
    )?.src || null;

  return {
    name,
    pronouns,
    headline,
    location,
    currentCompany,

    followers:
      extractCount(
        section.text,
        "followers"
      ),

    connections:
      extractCount(
        section.text,
        "connections"
      ),

    profileUrl:
      url,

    images: {
      profile:
        profileImage,

      cover:
        coverImage,
    },
  };
}

/* =========================================================
   ABOUT
   ========================================================= */

export function parseAbout(section) {
  if (!section) {
    return {
      about: null,
      topSkills: [],
    };
  }

  const text =
    section.text
      .replace(
        /^About\s*/i,
        ""
      )
      .trim();

  const chunks =
    text.split(
      /\n\s*Top skills\s*\n/i
    );

  return {
    about:
      clean(
        chunks[0]
      ),

    topSkills:
      chunks[1]
        ?.split("•")
        .map(clean)
        .filter(Boolean) ||
      [],
  };
}

/* =========================================================
   SHOW MORE
   ========================================================= */

async function clickShowMoreInsideSection(
  page,
  prefix
) {
  let didClick = false;

  for (
    let attempt = 0;
    attempt < 5;
    attempt++
  ) {
    const clicked =
      await page.evaluate(
        (prefix) => {
          const section =
            Array.from(
              document.querySelectorAll(
                "section"
              )
            ).find(
              (candidate) =>
                candidate.innerText
                  ?.trim()
                  .toLowerCase()
                  .startsWith(
                    prefix.toLowerCase()
                  )
            );

          if (!section) {
            return false;
          }

          const button =
            Array.from(
              section.querySelectorAll(
                "button"
              )
            ).find(
              (candidate) =>
                /^show more$/i.test(
                  candidate
                    .innerText
                    ?.trim()
                )
            );

          if (!button) {
            return false;
          }

          button.click();

          return true;
        },
        prefix
      );

    if (!clicked) {
      break;
    }

    didClick = true;

    console.log(
      `${prefix}: clicked Show more`
    );

    await sleep(2000);
  }

  return didClick;
}

/* =========================================================
   V11 DOM SINGLE-DATE EXPERIENCE DISCOVERY
   ========================================================= */

async function collectDomSingleDateExperienceRoles(
  page
) {
  return page.evaluate(() => {
    const main =
      document.querySelector(
        "main"
      );

    if (!main) {
      return [];
    }

    const cleanText = (
      value
    ) =>
      value
        ?.replace(
          /\u200b/g,
          ""
        )
        .replace(
          /\r/g,
          ""
        )
        .replace(
          /[ \t]+/g,
          " "
        )
        .trim() ||
      null;

    const getLines = (
      text
    ) =>
      (
        text || ""
      )
        .split("\n")
        .map(
          cleanText
        )
        .filter(Boolean)
        .filter(
          (line) =>
            line !== "·"
        );

    const singleDateRegex =
      /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{4}(?:\s*·\s*\d+\s+(?:mo|mos|yr|yrs|wk|wks|day|days))?$/i;

    const locationRegex =
      /(?:hybrid|remote|on-site|onsite)$/i;

    const employmentRegex =
      /(full-time|part-time|contract|self-employed|freelance|internship|apprenticeship|seasonal)/i;

    const badTitleRegex =
      /^(?:experience|certificate|skills?|show more|show all.*|see all.*)$/i;

    const organizationSelector =
      'a[href*="/company/"], a[href*="/school/"]';

    function canonicalize(
      href
    ) {
      if (!href) {
        return null;
      }

      try {
        const url =
          new URL(href);

        const pathname =
          url.pathname.replace(
            /\/+$/,
            ""
          );

        return `${url.origin}${pathname}/`;
      } catch {
        return href;
      }
    }

    function splitMeta(
      value
    ) {
      const pieces =
        (
          value || ""
        )
          .split("·")
          .map(
            cleanText
          )
          .filter(Boolean);

      const employmentType =
        pieces.find(
          (piece) =>
            employmentRegex.test(
              piece
            )
        ) || null;

      return {
        organization:
          pieces[0] ||
          null,

        employmentType,
      };
    }

    function parseSignature(
      element
    ) {
      const text =
        element.innerText
          ?.trim();

      if (
        !text ||
        text.length >
          4000
      ) {
        return null;
      }

      const ls =
        getLines(text);

      if (
        ls.length < 3 ||
        ls.length > 50
      ) {
        return null;
      }

      const dateIndex =
        ls.findIndex(
          (line) =>
            singleDateRegex.test(
              line
            )
        );

      if (
        dateIndex < 1 ||
        dateIndex > 10
      ) {
        return null;
      }

      const dateLine =
        ls[
          dateIndex
        ];

      const location =
        ls
          .slice(
            dateIndex + 1,
            dateIndex + 5
          )
          .find(
            (line) =>
              locationRegex.test(
                line
              )
          ) || null;

      if (!location) {
        return null;
      }

      let title =
        null;

      let organization =
        null;

      let employmentType =
        null;

      let organizationMeta =
        null;

      if (
        dateIndex >= 2 &&
        employmentRegex.test(
          ls[
            dateIndex - 1
          ]
        )
      ) {
        title =
          ls[
            dateIndex - 2
          ];

        organizationMeta =
          ls[
            dateIndex - 1
          ];

        const parsed =
          splitMeta(
            organizationMeta
          );

        organization =
          parsed.organization;

        employmentType =
          parsed.employmentType;
      } else {
        title =
          ls[
            dateIndex - 1
          ];
      }

      if (
        !title ||
        title.length > 120 ||
        badTitleRegex.test(
          title
        ) ||
        singleDateRegex.test(
          title
        ) ||
        locationRegex.test(
          title
        )
      ) {
        return null;
      }

      return {
        text,
        lines:
          ls,

        dateIndex,

        title,

        organization,

        organizationMeta,

        employmentType,

        dateLine,

        location,
      };
    }

    const results = [];

    const allElements =
      Array.from(
        main.querySelectorAll("*")
      );

    for (
      const element of
        allElements
    ) {
      const signature =
        parseSignature(
          element
        );

      if (!signature) {
        continue;
      }

      const childHasSignature =
        Array.from(
          element.children
        ).some(
          (child) =>
            Boolean(
              parseSignature(
                child
              )
            )
        );

      if (
        childHasSignature
      ) {
        continue;
      }

      let node =
        element;

      let organizationUrl =
        null;

      let anchorLines =
        [];

      let organizationDepth =
        null;

      for (
        let depth = 0;
        depth <= 8;
        depth++
      ) {
        if (
          !node ||
          node === main
        ) {
          break;
        }

        const anchors =
          Array.from(
            node.querySelectorAll(
              organizationSelector
            )
          );

        const byUrl =
          new Map();

        for (
          const anchor of
            anchors
        ) {
          const url =
            canonicalize(
              anchor.href
            );

          if (!url) {
            continue;
          }

          if (
            !byUrl.has(
              url
            )
          ) {
            byUrl.set(
              url,
              anchor
            );
          }
        }

        if (
          byUrl.size === 1
        ) {
          const [
            url,
            anchor,
          ] =
            Array.from(
              byUrl.entries()
            )[0];

          organizationUrl =
            url;

          anchorLines =
            getLines(
              anchor.innerText
            );

          organizationDepth =
            depth;

          break;
        }

        if (
          byUrl.size > 1
        ) {
          break;
        }

        node =
          node.parentElement;
      }

      if (
        !organizationUrl
      ) {
        continue;
      }

      let organization =
        signature.organization;

      let employmentType =
        signature.employmentType;

      if (
        !organization
      ) {
        const anchorMeta =
          anchorLines.find(
            (line) =>
              employmentRegex.test(
                line
              )
          );

        if (
          anchorMeta
        ) {
          const parsed =
            splitMeta(
              anchorMeta
            );

          organization =
            parsed.organization;

          employmentType =
            employmentType ||
            parsed.employmentType;
        }
      }

      if (
        !organization
      ) {
        organization =
          anchorLines.find(
            (line) =>
              line !==
                signature.title &&
              !singleDateRegex.test(
                line
              ) &&
              !locationRegex.test(
                line
              ) &&
              !badTitleRegex.test(
                line
              )
          ) || null;
      }

      if (
        !organization
      ) {
        continue;
      }

      results.push({
        title:
          signature.title,

        organization,

        organizationMeta:
          signature.organizationMeta,

        employmentType,

        dateLine:
          signature.dateLine,

        location:
          signature.location,

        organizationUrl,

        organizationDepth,

        text:
          signature.text,
      });
    }

    const seen =
      new Set();

    const deduped =
      [];

    for (
      const item of
        results
    ) {
      const key =
        [
          item.organizationUrl,
          item.title
            .toLowerCase(),
          item.dateLine
            .toLowerCase(),
        ].join("|");

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      deduped.push(
        item
      );
    }

    return deduped;
  });
}

/* =========================================================
   DETAIL PAGE LOADING
   ========================================================= */

async function loadDetailSection(
  context,
  url,
  expectedPrefix,
  scrollConfig,
  assertSession
) {
  const page =
    await context.newPage();

  try {
    console.log(
      `Opening ${expectedPrefix}...`
    );

    await navigateLinkedIn(
      page,
      url
    );

    await assertSession?.(
      page,
      url
    );

    await hydrateScroll(
      page,
      scrollConfig,
      expectedPrefix
    );

    const expanded =
      await clickShowMoreInsideSection(
      page,
      expectedPrefix
    );

    if (expanded) {
      await hydrateScroll(
        page,
        {
          ...scrollConfig,

          maxSteps:
            Math.min(
              scrollConfig.maxSteps,
              60
            ),
        },
        `${expectedPrefix} post-expand`
      );
    }

    let domSingleDateRoles =
      [];

    if (
      expectedPrefix ===
      "Experience"
    ) {
      domSingleDateRoles =
        await collectDomSingleDateExperienceRoles(
          page
        );

      console.log(
        `Experience DOM single-date candidates: ${domSingleDateRoles.length}`
      );

      if (
        domSingleDateRoles.length
      ) {
        console.table(
          domSingleDateRoles.map(
            (item) => ({
              title:
                item.title,

              organization:
                item.organization,

              employmentType:
                item.employmentType,

              date:
                item.dateLine,

              depth:
                item.organizationDepth,
            })
          )
        );
      }
    }

    const candidates =
      await page
        .locator("section")
        .evaluateAll(
          (
            sections,
            prefix
          ) =>
            sections
              .map(
                (
                  section,
                  index
                ) => ({
                  index,

                  text:
                    section.innerText
                      ?.trim() ||
                    "",

                  links:
                    Array.from(
                      section.querySelectorAll(
                        "a[href]"
                      )
                    )
                      .map(
                        (a) => ({
                          text:
                            a.innerText
                              ?.trim() ||
                            null,

                          href:
                            a.href ||
                            null,
                        })
                      )
                      .filter(
                        (link) =>
                          link.text ||
                          link.href
                      ),

                  images:
                    Array.from(
                      section.querySelectorAll(
                        "img"
                      )
                    )
                      .map(
                        (img) => ({
                          alt:
                            img.alt ||
                            null,

                          src:
                            img.currentSrc ||
                            img.src ||
                            null,
                        })
                      )
                      .filter(
                        (img) =>
                          img.src
                      ),
                })
              )
              .filter(
                (section) =>
                  section.text
                    .toLowerCase()
                    .startsWith(
                      prefix.toLowerCase()
                    )
              ),
          expectedPrefix
        );

    if (
      !candidates.length
    ) {
      return null;
    }

    candidates.sort(
      (a, b) =>
        a.text.length -
        b.text.length
    );

    const result =
      candidates[0];

    if (
      expectedPrefix ===
      "Experience"
    ) {
      result.domSingleDateRoles =
        domSingleDateRoles;
    }

    console.log(
      `${expectedPrefix}: detail section found (${result.text.length} chars)`
    );

    return result;
  } catch (error) {
    if (
      error?.code ===
      "upstream_authentication_required"
    ) {
      throw error;
    }

    console.log(
      `${expectedPrefix} failed: ${error.message}`
    );

    return null;
  } finally {
    await page.close();
  }
}

/* =========================================================
   EXPERIENCE
   ========================================================= */

function parseOrganizationHeader(
  data
) {
  if (!data?.length) {
    return {};
  }

  const organization =
    data[0] ||
    null;

  let employmentType =
    null;

  let location =
    null;

  for (
    let i = 1;
    i < data.length;
    i++
  ) {
    if (
      looksLikeEmploymentMeta(
        data[i]
      )
    ) {
      employmentType =
        extractEmploymentType(
          data[i]
        );
    }

    if (
      looksLikeExplicitWorkLocation(
        data[i]
      )
    ) {
      location =
        data[i];
    }
  }

  return {
    organization,
    employmentType,
    location,
  };
}

function parseRoleAnchor(
  link
) {
  const data =
    lines(
      link.text
    );

  const dateIndex =
    data.findIndex(
      isDateRange
    );

  if (
    dateIndex < 1
  ) {
    return null;
  }

  const title =
    data[0] ||
    null;

  let organization =
    null;

  let employmentType =
    null;

  let location =
    null;

  if (
    dateIndex !== 1
  ) {
    const organizationMeta =
      data[1];

    if (
      organizationMeta
    ) {
      const pieces =
        organizationMeta
          .split("·")
          .map(clean)
          .filter(Boolean);

      organization =
        pieces[0] ||
        null;

      employmentType =
        pieces.find(
          looksLikeEmploymentMeta
        ) ||
        null;
    }
  }

  for (
    let i =
      dateIndex + 1;
    i < data.length;
    i++
  ) {
    if (
      looksLikeExplicitWorkLocation(
        data[i]
      )
    ) {
      location =
        data[i];

      break;
    }
  }

  const dates =
    splitDateDuration(
      data[
        dateIndex
      ]
    );

  return {
    title,
    organization,
    employmentType,
    location,

    dateRange:
      dates.dateRange,

    duration:
      dates.duration,

    organizationUrl:
      canonicalLinkedInEntityUrl(
        link.href
      ),

    description:
      null,

    _source:
      "linked",

    _position:
      null,

    _datePosition:
      null,
  };
}

function findRolePosition(
  sectionLines,
  role,
  startAt = 0
) {
  for (
    let i = startAt;
    i < sectionLines.length;
    i++
  ) {
    if (
      sectionLines[i] !==
      role.title
    ) {
      continue;
    }

    const end =
      Math.min(
        sectionLines.length,
        i + 10
      );

    for (
      let j = i + 1;
      j < end;
      j++
    ) {
      const parsed =
        splitDateDuration(
          sectionLines[j]
        );

      if (
        normalize(
          parsed.dateRange
        ) ===
        normalize(
          role.dateRange
        )
      ) {
        return {
          position: i,
          datePosition: j,
        };
      }
    }
  }

  return {
    position: null,
    datePosition: null,
  };
}

export function parseExperience(
  section
) {
  if (!section) {
    return {
      organizations: [],

      debug: {
        linkedRoles: 0,
        domFallbackRoles: 0,
        totalRoles: 0,
        domFallbackRoleDetails: [],
      },
    };
  }

  const sectionLines =
    lines(
      section.text
    ).filter(
      (line) =>
        !/^experience$/i.test(
          line
        )
    );

  const organizationLinks =
    section.links.filter(
      (link) =>
        link.text &&
        isLinkedInOrganizationUrl(
          link.href
        )
    );

  const organizationHeaders =
    new Map();

  for (
    const link of
      organizationLinks
  ) {
    const data =
      lines(
        link.text
      );

    if (
      data.some(
        isExperienceDate
      )
    ) {
      continue;
    }

    const url =
      canonicalLinkedInEntityUrl(
        link.href
      );

    if (!url) {
      continue;
    }

    const parsed =
      parseOrganizationHeader(
        data
      );

    if (
      !parsed.organization
    ) {
      continue;
    }

    if (
      !organizationHeaders.has(
        url
      )
    ) {
      organizationHeaders.set(
        url,
        parsed
      );
    }
  }

  const linkedRoles =
    organizationLinks
      .filter(
        (link) =>
          lines(
            link.text
          ).some(
            isDateRange
          )
      )
      .map(
        parseRoleAnchor
      )
      .filter(Boolean)
      .map(
        (role) => {
          const header =
            organizationHeaders.get(
              role.organizationUrl
            ) || {};

          return {
            ...role,

            organization:
              header.organization ||
              role.organization ||
              null,

            employmentType:
              header.employmentType ||
              role.employmentType ||
              null,

            location:
              role.location ||
              header.location ||
              null,

            organizationLocation:
              header.location ||
              null,
          };
        }
      );

  for (
    const role of
      linkedRoles
  ) {
    if (
      !role.organizationUrl ||
      !role.organization
    ) {
      continue;
    }

    if (
      !organizationHeaders.has(
        role.organizationUrl
      )
    ) {
      organizationHeaders.set(
        role.organizationUrl,
        {
          organization:
            role.organization,

          employmentType:
            role.employmentType ||
            null,

          location:
            role.location ||
            null,
        }
      );
    }
  }

  for (
    const candidate of
      section.domSingleDateRoles ||
      []
  ) {
    const url =
      canonicalLinkedInEntityUrl(
        candidate.organizationUrl
      );

    if (
      !url ||
      !candidate.organization
    ) {
      continue;
    }

    const existing =
      organizationHeaders.get(
        url
      );

    if (!existing) {
      organizationHeaders.set(
        url,
        {
          organization:
            candidate.organization,

          employmentType:
            candidate.employmentType ||
            null,

          location:
            candidate.location ||
            null,
        }
      );

      continue;
    }

    if (
      !existing.organization
    ) {
      existing.organization =
        candidate.organization;
    }

    if (
      !existing.employmentType
    ) {
      existing.employmentType =
        candidate.employmentType ||
        null;
    }

    if (
      !existing.location
    ) {
      existing.location =
        candidate.location ||
        null;
    }
  }

  let searchCursor = 0;

  for (
    const role of
      linkedRoles
  ) {
    const found =
      findRolePosition(
        sectionLines,
        role,
        searchCursor
      );

    role._position =
      found.position;

    role._datePosition =
      found.datePosition;

    if (
      found.position != null
    ) {
      searchCursor =
        found.position + 1;
    }
  }

  const domFallbackRoles =
    [];

  for (
    const candidate of
      section.domSingleDateRoles ||
      []
  ) {
    const organizationUrl =
      canonicalLinkedInEntityUrl(
        candidate.organizationUrl
      );

    if (
      !organizationUrl ||
      !candidate.organization ||
      !candidate.title
    ) {
      continue;
    }

    const dates =
      splitDateDuration(
        candidate.dateLine
      );

    const header =
      organizationHeaders.get(
        organizationUrl
      ) || {
        organization:
          candidate.organization,

        employmentType:
          candidate.employmentType ||
          null,

        location:
          candidate.location ||
          null,
      };

    const duplicate =
      linkedRoles.some(
        (role) =>
          role.organizationUrl ===
            organizationUrl &&
          normalize(
            role.title
          ) ===
            normalize(
              candidate.title
            ) &&
          normalize(
            role.dateRange
          ) ===
            normalize(
              dates.dateRange
            )
      ) ||
      domFallbackRoles.some(
        (role) =>
          role.organizationUrl ===
            organizationUrl &&
          normalize(
            role.title
          ) ===
            normalize(
              candidate.title
            ) &&
          normalize(
            role.dateRange
          ) ===
            normalize(
              dates.dateRange
            )
      );

    if (duplicate) {
      continue;
    }

    const role = {
      title:
        candidate.title,

      organization:
        candidate.organization ||
        header.organization ||
        null,

      employmentType:
        candidate.employmentType ||
        header.employmentType ||
        null,

      location:
        candidate.location ||
        header.location ||
        null,

      organizationLocation:
        header.location ||
        candidate.location ||
        null,

      dateRange:
        dates.dateRange,

      duration:
        dates.duration,

      organizationUrl,

      description:
        null,

      _source:
        "dom-single-date",

      _position:
        null,

      _datePosition:
        null,
    };

    const found =
      findRolePosition(
        sectionLines,
        role,
        0
      );

    role._position =
      found.position;

    role._datePosition =
      found.datePosition;

    domFallbackRoles.push(
      role
    );
  }

  const allRoles =
    [
      ...linkedRoles,
      ...domFallbackRoles,
    ];

  allRoles.sort(
    (a, b) =>
      (
        a._position ??
        Number.MAX_SAFE_INTEGER
      ) -
      (
        b._position ??
        Number.MAX_SAFE_INTEGER
      )
  );

  const knownOrganizationNames =
    new Set();

  const knownLocations =
    new Set();

  for (
    const header of
      organizationHeaders.values()
  ) {
    if (
      header.organization
    ) {
      knownOrganizationNames.add(
        normalize(
          header.organization
        )
      );
    }

    if (
      header.location
    ) {
      knownLocations.add(
        normalize(
          header.location
        )
      );
    }
  }

  for (
    const role of
      allRoles
  ) {
    if (
      role.location
    ) {
      knownLocations.add(
        normalize(
          role.location
        )
      );
    }
  }

  for (
    let i = 0;
    i < allRoles.length;
    i++
  ) {
    const role =
      allRoles[i];

    if (
      role._position == null
    ) {
      continue;
    }

    const contentStart =
      role._datePosition != null
        ? role._datePosition + 1
        : role._position + 1;

    let end =
      sectionLines.length;

    for (
      let j = i + 1;
      j < allRoles.length;
      j++
    ) {
      if (
        allRoles[j]
          ._position != null &&
        allRoles[j]
          ._position >
          role._position
      ) {
        end =
          allRoles[j]
            ._position;

        break;
      }
    }

    for (
      let j =
        contentStart;
      j < end;
      j++
    ) {
      if (
        knownOrganizationNames.has(
          normalize(
            sectionLines[j]
          )
        )
      ) {
        end = j;

        break;
      }
    }

    const descriptionLines =
      sectionLines
        .slice(
          contentStart,
          end
        )
        .filter(
          (line) => {
            const normalized =
              normalize(
                line
              );

            if (
              isExperienceDate(
                line
              )
            ) {
              return false;
            }

            if (
              knownOrganizationNames.has(
                normalized
              )
            ) {
              return false;
            }

            if (
              knownLocations.has(
                normalized
              )
            ) {
              return false;
            }

            if (
              looksLikeEmploymentMeta(
                line
              )
            ) {
              return false;
            }

            if (
              /^skills?:/i.test(
                line
              )
            ) {
              return false;
            }

            if (
              /\+\d+\s+skills?$/i.test(
                line
              )
            ) {
              return false;
            }

            if (
              /^certificate$/i.test(
                line
              )
            ) {
              return false;
            }

            if (
              /^linkedin helped/i.test(
                line
              )
            ) {
              return false;
            }

            if (
              /^helped me get this job$/i.test(
                line
              )
            ) {
              return false;
            }

            return true;
          }
        );

    role.description =
      clean(
        descriptionLines.join(
          "\n"
        )
      );
  }

  const grouped =
    new Map();

  for (
    const role of
      allRoles
  ) {
    if (
      !role.organizationUrl
    ) {
      continue;
    }

    const key =
      role.organizationUrl;

    if (
      !grouped.has(
        key
      )
    ) {
      grouped.set(
        key,
        {
          company:
            role.organization ||
            null,

          companyUrl:
            role.organizationUrl,

          employmentType:
            role.employmentType ||
            null,

          location:
            role.organizationLocation ||
            role.location ||
            null,

          roles: [],
        }
      );
    }

    const organization =
      grouped.get(
        key
      );

    if (
      !organization.company &&
      role.organization
    ) {
      organization.company =
        role.organization;
    }

    if (
      !organization.employmentType &&
      role.employmentType
    ) {
      organization.employmentType =
        role.employmentType;
    }

    if (
      !organization.location &&
      role.location
    ) {
      organization.location =
        role.location;
    }

    organization.roles.push({
      title:
        role.title,

      dateRange:
        role.dateRange,

      duration:
        role.duration,

      location:
        role.location ||
        organization.location ||
        null,

      description:
        role.description,
    });
  }

  return {
    organizations:
      Array.from(
        grouped.values()
      ),

    debug: {
      linkedRoles:
        linkedRoles.length,

      domFallbackRoles:
        domFallbackRoles.length,

      totalRoles:
        allRoles.length,

      domFallbackRoleDetails:
        domFallbackRoles.map(
          (role) => ({
            title:
              role.title,

            organization:
              role.organization,

            employmentType:
              role.employmentType,

            dateRange:
              role.dateRange,

            duration:
              role.duration,

            organizationUrl:
              role.organizationUrl,

            location:
              role.location,

            position:
              role._position,
          })
        ),
    },
  };
}

/* =========================================================
   EDUCATION
   ========================================================= */

function findLineSequence(
  haystack,
  needle,
  startAt = 0
) {
  if (
    !needle.length ||
    needle.length >
      haystack.length
  ) {
    return -1;
  }

  for (
    let i = startAt;
    i <=
    haystack.length -
      needle.length;
    i++
  ) {
    let matches = true;

    for (
      let j = 0;
      j < needle.length;
      j++
    ) {
      if (
        haystack[
          i + j
        ] !==
        needle[j]
      ) {
        matches = false;

        break;
      }
    }

    if (matches) {
      return i;
    }
  }

  return -1;
}

export function parseEducation(
  section,
  expectedCount = null
) {
  if (!section) {
    return [];
  }

  const rawLines =
    lines(
      section.text
    ).filter(
      (line) =>
        !/^education$/i.test(
          line
        )
    );

  const consumed =
    new Array(
      rawLines.length
    ).fill(false);

  rawLines.forEach(
    (
      line,
      index
    ) => {
      if (
        /^skills?:/i.test(
          line
        ) ||
        /^show all/i.test(
          line
        )
      ) {
        consumed[index] =
          true;
      }
    }
  );

  const relevantLinks =
    section.links.filter(
      (link) =>
        link.text &&
        (
          link.href?.includes(
            "linkedin.com/school/"
          ) ||
          link.href?.includes(
            "linkedin.com/company/"
          )
        )
    );

  const entries = [];

  let searchCursor = 0;

  for (
    const link of
      relevantLinks
  ) {
    const data =
      lines(
        link.text
      );

    if (!data.length) {
      continue;
    }

    const institution =
      data[0];

    let position =
      findLineSequence(
        rawLines,
        data,
        searchCursor
      );

    if (
      position < 0
    ) {
      position =
        rawLines.findIndex(
          (line) =>
            line ===
            institution
        );
    }

    if (
      position >= 0
    ) {
      for (
        let j = 0;
        j < data.length;
        j++
      ) {
        if (
          position + j <
          consumed.length
        ) {
          consumed[
            position + j
          ] = true;
        }
      }

      searchCursor =
        position +
        data.length;
    }

    const dateIndex =
      data.findIndex(
        isDateRange
      );

    let degree =
      null;

    if (
      dateIndex > 1
    ) {
      degree =
        clean(
          data
            .slice(
              1,
              dateIndex
            )
            .join(" ")
        );
    } else if (
      dateIndex === -1 &&
      data.length > 1
    ) {
      degree =
        clean(
          data
            .slice(1)
            .join(" ")
        );
    }

    entries.push({
      institution,
      degree,

      dateRange:
        dateIndex >= 0
          ? splitDateDuration(
              data[
                dateIndex
              ]
            ).dateRange
          : null,

      linkedinUrl:
        link.href,

      _position:
        position >= 0
          ? position
          : Number.MAX_SAFE_INTEGER,
    });
  }

  let uniqueEntries =
    uniqueBy(
      entries,
      (item) =>
        `${normalize(
          item.institution
        )}|${normalize(
          item.degree
        )}`
    );

  if (
    expectedCount != null &&
    uniqueEntries.length >=
      expectedCount
  ) {
    uniqueEntries.sort(
      (a, b) =>
        a._position -
        b._position
    );

    return uniqueEntries.map(
      ({
        _position,
        ...entry
      }) => entry
    );
  }

  if (
    expectedCount == null
  ) {
    uniqueEntries.sort(
      (a, b) =>
        a._position -
        b._position
    );

    return uniqueEntries.map(
      ({
        _position,
        ...entry
      }) => entry
    );
  }

  const leftoverBlocks = [];

  let currentBlock = [];

  for (
    let i = 0;
    i < rawLines.length;
    i++
  ) {
    if (
      consumed[i]
    ) {
      if (
        currentBlock.length
      ) {
        leftoverBlocks.push(
          currentBlock
        );

        currentBlock = [];
      }

      continue;
    }

    currentBlock.push({
      index: i,

      text:
        rawLines[i],
    });
  }

  if (
    currentBlock.length
  ) {
    leftoverBlocks.push(
      currentBlock
    );
  }

  for (
    const block of
      leftoverBlocks
  ) {
    if (
      uniqueEntries.length >=
      expectedCount
    ) {
      break;
    }

    const blockLines =
      block
        .map(
          (item) =>
            item.text
        )
        .filter(Boolean);

    if (
      blockLines.length < 2 ||
      blockLines.length > 4
    ) {
      continue;
    }

    if (
      blockLines.some(
        (line) =>
          /^skills?:/i.test(
            line
          ) ||
          /^show all/i.test(
            line
          ) ||
          /^grade:/i.test(
            line
          ) ||
          /^activities and societies:/i.test(
            line
          )
      )
    ) {
      continue;
    }

    const dateIndex =
      blockLines.findIndex(
        isDateRange
      );

    if (
      dateIndex >= 0 &&
      dateIndex !==
        blockLines.length - 1
    ) {
      continue;
    }

    const institution =
      blockLines[0];

    const degree =
      clean(
        (
          dateIndex >= 0
            ? blockLines.slice(
                1,
                dateIndex
              )
            : blockLines.slice(
                1
              )
        ).join(" ")
      );

    if (
      !institution ||
      !degree
    ) {
      continue;
    }

    const duplicate =
      uniqueEntries.some(
        (entry) =>
          normalize(
            entry.institution
          ) ===
            normalize(
              institution
            ) &&
          normalize(
            entry.degree
          ) ===
            normalize(
              degree
            )
      );

    if (duplicate) {
      continue;
    }

    uniqueEntries.push({
      institution,
      degree,

      dateRange:
        dateIndex >= 0
          ? splitDateDuration(
              blockLines[
                dateIndex
              ]
            ).dateRange
          : null,

      linkedinUrl:
        null,

      _position:
        block[0].index,
    });
  }

  uniqueEntries.sort(
    (a, b) =>
      a._position -
      b._position
  );

  return uniqueEntries.map(
    ({
      _position,
      ...entry
    }) => entry
  );
}

/* =========================================================
   CERTIFICATIONS
   ========================================================= */

export function parseCertifications(
  section
) {
  if (!section) {
    return [];
  }

  const data =
    lines(
      section.text
    ).filter(
      (line) =>
        !/^licenses & certifications$/i.test(
          line
        )
    );

  const issuedIndexes = [];

  data.forEach(
    (
      line,
      index
    ) => {
      if (
        /^issued\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i.test(
          line
        )
      ) {
        issuedIndexes.push(
          index
        );
      }
    }
  );

  const credentialUrls =
    section.links
      .filter(
        (link) =>
          /^show credential$/i.test(
            clean(
              link.text
            ) || ""
          )
      )
      .map(
        (link) =>
          link.href
      );

  const results = [];

  for (
    let i = 0;
    i <
    issuedIndexes.length;
    i++
  ) {
    const index =
      issuedIndexes[i];

    const name =
      data[
        index - 2
      ] || null;

    const issuer =
      data[
        index - 1
      ] || null;

    const nextIndex =
      issuedIndexes[
        i + 1
      ];

    const end =
      nextIndex != null
        ? Math.max(
            index + 1,
            nextIndex - 2
          )
        : data.length;

    const details =
      data.slice(
        index + 1,
        end
      );

    const credentialLine =
      details.find(
        (line) =>
          /^credential id/i.test(
            line
          )
      );

    const skillsLine =
      details.find(
        (line) =>
          /^skills?:/i.test(
            line
          )
      );

    results.push({
      name,
      issuer,

      issued:
        clean(
          data[
            index
          ].replace(
            /^issued\s+/i,
            ""
          )
        ),

      credentialId:
        credentialLine
          ? clean(
              credentialLine.replace(
                /^credential id\s*/i,
                ""
              )
            )
          : null,

      credentialUrl:
        credentialUrls[
          i
        ] || null,

      skills:
        skillsLine
          ? skillsLine
              .replace(
                /^skills?:\s*/i,
                ""
              )
              .split(",")
              .map(clean)
              .filter(Boolean)
          : [],
    });
  }

  return results;
}

/* =========================================================
   CONFIRMED SKILLS
   ========================================================= */

function extractConfirmedSkills({
  topSkills = [],
  experienceSection = null,
  certifications = [],
}) {
  const confirmed =
    new Set();

  function addSkill(value) {
    const skill =
      clean(value);

    if (!skill) {
      return;
    }

    if (
      /^\+\d+\s+skills?$/i.test(
        skill
      )
    ) {
      return;
    }

    confirmed.add(
      normalize(
        skill
      )
    );
  }

  for (
    const skill of
      topSkills
  ) {
    addSkill(skill);
  }

  for (
    const cert of
      certifications
  ) {
    for (
      const skill of
        cert.skills || []
    ) {
      addSkill(skill);
    }
  }

  if (
    experienceSection?.text
  ) {
    for (
      const line of
        lines(
          experienceSection.text
        )
    ) {
      const match =
        line.match(
          /^skills?:\s*(.+)$/i
        );

      if (!match) {
        continue;
      }

      for (
        const value of
          match[1]
            .split(",")
            .map(clean)
            .filter(Boolean)
      ) {
        addSkill(value);
      }
    }
  }

  return confirmed;
}

/* =========================================================
   SKILLS
   ========================================================= */

export function parseSkills(
  section,
  context = {}
) {
  if (!section) {
    return {
      skills: [],
      rawCandidates: [],
      filteredNoise: [],
    };
  }

  const {
    experience = [],
    education = [],
    certifications = [],
    confirmedSkills =
      new Set(),
  } = context;

  const staticIgnored =
    new Set(
      [
        "skills",
        "all",
        "industry knowledge",
        "tools & technologies",
        "interpersonal skills",
        "other skills",
      ].map(normalize)
    );

  const dynamicNoise =
    new Set();

  const knownRoleTitles =
    new Set();

  for (
    const company of
      experience
  ) {
    for (
      const role of
        company.roles || []
    ) {
      if (
        role.title
      ) {
        knownRoleTitles.add(
          normalize(
            role.title
          )
        );
      }

      if (
        role.title &&
        company.company
      ) {
        dynamicNoise.add(
          normalize(
            `${role.title} at ${company.company}`
          )
        );
      }
    }
  }

  for (
    const item of
      education
  ) {
    if (
      item.institution
    ) {
      dynamicNoise.add(
        normalize(
          item.institution
        )
      );
    }
  }

  for (
    const cert of
      certifications
  ) {
    if (
      cert.name
    ) {
      dynamicNoise.add(
        normalize(
          cert.name
        )
      );
    }
  }

  const rawCandidates =
    [
      ...new Set(
        lines(
          section.text
        )
          .filter(
            (line) =>
              !staticIgnored.has(
                normalize(
                  line
                )
              )
          )
          .filter(
            (line) =>
              !/certificate\+of\+completion/i.test(
                line
              )
          )
          .filter(
            (line) =>
              !/^show more$/i.test(
                line
              )
          )
      ),
    ];

  const filteredNoise = [];

  const skills = [];

  for (
    const candidate of
      rawCandidates
  ) {
    const normalized =
      normalize(
        candidate
      );

    if (
      confirmedSkills.has(
        normalized
      )
    ) {
      skills.push(
        candidate
      );

      continue;
    }

    let noiseReason =
      null;

    if (
      dynamicNoise.has(
        normalized
      )
    ) {
      noiseReason =
        "known-profile-entity";
    }

    if (
      !noiseReason
    ) {
      const match =
        candidate.match(
          /^(.+?)\s+at\s+.+$/i
        );

      if (match) {
        const possibleRole =
          normalize(
            match[1]
          );

        if (
          knownRoleTitles.has(
            possibleRole
          )
        ) {
          noiseReason =
            "role-association";
        }
      }
    }

    if (
      !noiseReason &&
      /^endorsed by\b/i.test(
        candidate
      )
    ) {
      noiseReason =
        "endorsement-metadata";
    }

    if (
      !noiseReason &&
      /^\d+\s+endorsements?$/i.test(
        candidate
      )
    ) {
      noiseReason =
        "endorsement-count";
    }

    if (
      !noiseReason &&
      /^\d+\s+experiences?\s+at\b/i.test(
        candidate
      )
    ) {
      noiseReason =
        "experience-association";
    }

    if (
      !noiseReason &&
      /^passed linkedin skill assessment$/i.test(
        candidate
      )
    ) {
      noiseReason =
        "assessment-metadata";
    }

    if (
      noiseReason
    ) {
      filteredNoise.push({
        value:
          candidate,

        reason:
          noiseReason,
      });

      continue;
    }

    skills.push(
      candidate
    );
  }

  return {
    skills:
      [...new Set(skills)],

    rawCandidates,

    filteredNoise,
  };
}

/* =========================================================
   LANGUAGES
   ========================================================= */

export function parseLanguages(
  section
) {
  if (!section) {
    return [];
  }

  const data =
    lines(
      section.text
    ).filter(
      (line) =>
        !/^languages$/i.test(
          line
        )
    );

  if (
    data.some(
      (line) =>
        /nothing to see for now/i.test(
          line
        )
    )
  ) {
    return [];
  }

  const results = [];

  for (
    let i = 0;
    i < data.length;
    i += 2
  ) {
    results.push({
      language:
        data[i] ||
        null,

      proficiency:
        data[
          i + 1
        ] || null,
    });
  }

  return results;
}

/* =========================================================
   EXPECTED COUNTS
   ========================================================= */

function getExpectedSkillCount(
  sections
) {
  for (
    const section of
      sections
  ) {
    const heading =
      section.primaryHeading ||
      "";

    const match =
      heading.match(
        /^Skills\s*\((\d+)\)$/i
      );

    if (match) {
      return Number(
        match[1]
      );
    }
  }

  return null;
}

function getExpectedEducationCount(
  sections
) {
  for (
    const section of
      sections
  ) {
    const match =
      section.text.match(
        /show all\s+(\d+)\s+educations?/i
      );

    if (match) {
      return Number(
        match[1]
      );
    }
  }

  return null;
}

/* =========================================================
   MAIN
   ========================================================= */


export const parserVersion = "v11";

export async function extractLinkedInProfile({
  context,
  profileUrl,
  includeDebug = false,
  assertSession,
}) {
  const profilePage =
    await context.newPage();

  try {
    await navigateLinkedIn(
      profilePage,
      profileUrl
    );

    await assertSession?.(
      profilePage,
      profileUrl
    );

    const resolvedProfileUrl =
      profilePage.url();

    const base =
      getBaseUrl(
        resolvedProfileUrl
      );

    const pageTitle =
      await profilePage.title();

    const expectedName =
      clean(
        pageTitle.replace(
          /\s*\|\s*LinkedIn\s*$/i,
          ""
        )
      );

    await sleep(2500);

    await hydrateScroll(
      profilePage,
      SCROLL_CONFIG.mainProfile,
      "Main profile"
    );

    await assertSession?.(
      profilePage,
      profileUrl
    );

    const mainSections =
      await collectSections(
        profilePage
      );

    const headerSection =
      findHeaderSection(
        mainSections,
        expectedName
      );

    const aboutSection =
      getMainSection(
        mainSections,
        "About"
      );

    const expectedSkillCount =
      getExpectedSkillCount(
        mainSections
      );

    const expectedEducationCount =
      getExpectedEducationCount(
        mainSections
      );

    const header =
      parseHeader(
        headerSection,
        resolvedProfileUrl
      );

    const about =
      parseAbout(
        aboutSection
      );

    // Everything needed from the main profile is now plain data. Closing this
    // renderer before loading detail routes keeps only one LinkedIn page alive
    // at a time, which is critical on 512 MB hosting instances.
    await profilePage
      .close()
      .catch(() => {});

    const routes = {
      experience:
        `${base}/details/experience/`,

      education:
        `${base}/details/education/`,

      certifications:
        `${base}/details/certifications/`,

      skills:
        `${base}/details/skills/`,

      languages:
        `${base}/details/languages/`,
    };

    const experienceSection =
      await loadDetailSection(
        context,
        routes.experience,
        "Experience",
        SCROLL_CONFIG.detailPage,
        assertSession
      );

    const educationSection =
      await loadDetailSection(
        context,
        routes.education,
        "Education",
        SCROLL_CONFIG.detailPage,
        assertSession
      );

    const certificationSection =
      await loadDetailSection(
        context,
        routes.certifications,
        "Licenses & certifications",
        SCROLL_CONFIG.detailPage,
        assertSession
      );

    const skillsSection =
      await loadDetailSection(
        context,
        routes.skills,
        "Skills",
        SCROLL_CONFIG.skills,
        assertSession
      );

    const languagesSection =
      await loadDetailSection(
        context,
        routes.languages,
        "Languages",
        SCROLL_CONFIG.detailPage,
        assertSession
      );

    const experienceResult =
      parseExperience(
        experienceSection
      );

    const experience =
      experienceResult
        .organizations;

    const education =
      parseEducation(
        educationSection,
        expectedEducationCount
      );

    const certifications =
      parseCertifications(
        certificationSection
      );

    const confirmedSkills =
      extractConfirmedSkills({
        topSkills:
          about.topSkills,

        experienceSection,

        certifications,
      });

    const skillsResult =
      parseSkills(
        skillsSection,
        {
          experience,
          education,
          certifications,
          confirmedSkills,
        }
      );

    const languages =
      parseLanguages(
        languagesSection
      );

    const result = {
      scrapedAt:
        new Date().toISOString(),

      source: {
        platform:
          "linkedin",

        profileUrl:
          resolvedProfileUrl,
      },

      profile: {
        name:
          header.name ||
          expectedName ||
          null,

        pronouns:
          header.pronouns ||
          null,

        headline:
          header.headline ||
          null,

        location:
          header.location ||
          null,

        currentCompany:
          header.currentCompany ||
          null,

        followers:
          header.followers ||
          null,

        connections:
          header.connections ||
          null,

        images:
          header.images || {
            profile: null,
            cover: null,
          },

        about:
          about.about,

        topSkills:
          about.topSkills,
      },

      experience,
      education,
      certifications,

      skills:
        skillsResult.skills,

      languages,

      debug: {
        parserVersion,

        detailPages: {
          experience:
            Boolean(
              experienceSection
            ),

          education:
            Boolean(
              educationSection
            ),

          certifications:
            Boolean(
              certificationSection
            ),

          skills:
            Boolean(
              skillsSection
            ),

          languages:
            Boolean(
              languagesSection
            ),
        },

        expectedCounts: {
          education:
            expectedEducationCount,

          skills:
            expectedSkillCount,
        },

        actualCounts: {
          organizations:
            experience.length,

          roles:
            experience.reduce(
              (
                total,
                organization
              ) =>
                total +
                (
                  organization
                    .roles
                    ?.length ||
                  0
                ),
              0
            ),

          education:
            education.length,

          certifications:
            certifications.length,

          skills:
            skillsResult
              .skills.length,

          languages:
            languages.length,
        },

        experience: {
          linkedRoles:
            experienceResult
              .debug
              .linkedRoles,

          domFallbackRoles:
            experienceResult
              .debug
              .domFallbackRoles,

          totalRoles:
            experienceResult
              .debug
              .totalRoles,

          domFallbackRoleDetails:
            experienceResult
              .debug
              .domFallbackRoleDetails,

          rawDomCandidates:
            experienceSection
              ?.domSingleDateRoles ||
            [],
        },

        skills: {
          rawCandidates:
            skillsResult
              .rawCandidates
              .length,

          removedMetadata:
            skillsResult
              .filteredNoise
              .length,

          finalSkills:
            skillsResult
              .skills
              .length,

          confirmedSkills:
            Array.from(
              confirmedSkills
            ),

          filteredNoise:
            skillsResult
              .filteredNoise,
        },

        rawSectionSizes: {
          mainSections:
            mainSections.length,

          experienceChars:
            experienceSection
              ?.text.length ||
            0,

          educationChars:
            educationSection
              ?.text.length ||
            0,

          certificationChars:
            certificationSection
              ?.text.length ||
            0,

          skillsChars:
            skillsSection
              ?.text.length ||
            0,

          languageChars:
            languagesSection
              ?.text.length ||
            0,
        },
      },
    };

    if (
      !includeDebug
    ) {
      delete result.debug;
    }

    return result;
  } finally {
    await profilePage
      .close()
      .catch(() => {});
  }
}
