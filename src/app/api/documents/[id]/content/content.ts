const url =
  "https://api.ragie.ai/documents/470b4180-1a67-49c5-99e6-fada1c4a2b2b/content";
const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    authorization:
      "Bearer tnt_64UXzUTUJG5_3MaWfcDjVRZL7ZOpXeInwV6lME8aPpqHWBUdeBOr0XV",
  },
};

fetch(url, options)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((err) => console.error(err));
