// Envs

const env = {
  API_URL: $API_URL,
  ACTIVITIES_ENDPOINT: "/challenges/v1/activities",
  SESSIONS_ENDPOINT: "/challenges/v1/activities/sessions",
  API_KEY: $API_KEY,
};

// Global vars

const SESSION_TIME = 5 * 60 * 1000;

// Utils

/**
 * Returns the difference between two times in seconds
 * @param {String} firstTime - first time
 * @param {String} secondTime - second time
 * @return {number} seconds
 */
const getSecondsDiff = (firstTime, secondTime) => {
  const firstTimeDate = new Date(firstTime);
  const secondTimeDate = new Date(secondTime);
  const diff =
    Math.abs(secondTimeDate.getTime() - firstTimeDate.getTime()) / 1000;

  return diff;
};

/**
 * Returns an object of elements grouped by a given key
 * @param {Array} array - list
 * @param {String} key - key
 * @return {Object} elements grouped
 */
const groupBy = (array, key) =>
  array.reduce((acc, curr) => {
    acc[curr[key]] = [...(acc[curr[key]] || []), curr];
    return acc;
  }, {});

/**
 * Returns an error message according response status from fetch
 * @param {number} resStatus - response status
 * @return {String} error message
 */
const handleError = (resStatus) => {
  const errInfo = {
    400: "Bad request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not found",
    429: "Too many requests",
    500: "Internal server error",
  };

  return errInfo[resStatus] || "Something went wrong";
};

/**
 * Returns an array sorted ascending by a given key
 * @param {Array} array - list
 * @param {String} key - key
 * @return {Array} list sorted
 */
const sortArrAsc = (array, key) =>
  array.sort((a, b) => new Date(a[key]) - new Date(b[key]));

// API Fetchs

/**
 * Gets user activities from API and returns a list of activities on success
 * @return {Array} list of user activities
 */
const getActivities = async () => {
  try {
    const response = await fetch(env.API_URL + env.ACTIVITIES_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: env.API_KEY,
      },
    });
    if (response?.ok || response?.status === 200) {
      const { activities } = await response.json();
      return activities;
    } else {
      throw new Error(handleError(response?.status));
    }
  } catch (err) {
    console.error("Error:", err);
  }
};

/**
 * Posts user sessions to API
 * @param {Object} sessions - user sessions
 */
const postSessions = async (sessions) => {
  try {
    const response = await fetch(env.API_URL + env.SESSIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: env.API_KEY,
      },
      body: JSON.stringify(sessions),
    });
    if (response?.ok || response?.status === 204) {
      console.log("Sessions posted successfully");
    } else {
      throw new Error(handleError(response?.status));
    }
  } catch (err) {
    console.error("Error:", err);
  }
};

// Program

/**
 * Returns true if detects a concluded session
 * Session: Is defined as the time between first_seen_at of the first user’s activity
 * to the answered_at of the latest activity for a given user, as long as there isn’t more than 5
 * minutes between them.
 * @param {String} answeredAt - time of the latest user's activity
 * @param {String} firstSeenAt - time of the first user’s activity
 * @return {boolean} is concluded session or not
 */
const isSessionConcluded = (answeredAt, firstSeenAt) => {
  const answeredAtDate = new Date(answeredAt);
  const firstSeenAtDate = new Date(firstSeenAt);
  const diff = Math.abs(firstSeenAtDate - answeredAtDate);

  return diff > SESSION_TIME ? true : false;
};

/**
 * Returns user sessions
 * @return {Object} user sessions
 */
const getSessions = async () => {
  activities = await getActivities();

  if (activities?.length) {
    let sessions = {};
    let activitiesGrouped = [];
    let activitiesSorted = [];

    activitiesSorted = sortArrAsc(activities, "first_seen_at");
    activitiesGrouped = groupBy(activitiesSorted, "user_id");

    sessions = Object.entries(activitiesGrouped).reduce((acc, curr) => {
      let activityIds = [];
      let durationSeconds = 0;
      let sessionList = [];
      let session = {};

      const [userId, activities] = curr;

      for (let index = 0; index < activities?.length; index++) {
        const firstSeenAt = activities[index]?.first_seen_at;
        const answeredAt = activities[index]?.answered_at;
        const firstSeenAtNext =
          activities[index + 1]?.first_seen_at || answeredAt;

        activityIds.push(activities[index]?.id);
        durationSeconds += getSecondsDiff(firstSeenAt, answeredAt);

        if (
          isSessionConcluded(answeredAt, firstSeenAtNext) ||
          index === activities?.length - 1
        ) {
          const startedAt =
            activities[index - activityIds?.length + 1]?.first_seen_at;

          session = {
            ended_at: answeredAt,
            started_at: startedAt,
            activity_ids: activityIds,
            duration_seconds: durationSeconds,
          };

          sessionList.push(session);

          activityIds = [];
          durationSeconds = 0;
        }
      }

      acc[userId] = sessionList;

      return acc;
    }, {});

    return { user_sessions: sessions };
  }
};

/**
 * Let's rock!
 */
const runChallenge = async () => {
  const sessions = await getSessions();

  if (sessions?.user_sessions) {
    await postSessions(sessions);
  }
};

runChallenge();