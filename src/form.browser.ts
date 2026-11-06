/// <reference types="@types/web" />

(function () {
  // Get dataset and ids
  const dataset = document.currentScript?.dataset;
  if (!dataset || !dataset.form_id || !dataset.message_id) return;

  // Get elements
  const formElement = document.getElementById(dataset.form_id) as HTMLFormElement;
  if (!formElement) return;
  const messageElement = document.getElementById(dataset.message_id) as HTMLParagraphElement;
  if (!messageElement) return;

  formElement.addEventListener("formdata", async function (event) {
    event.preventDefault();

    const res = await fetch(formElement.action, {
      "method": formElement.method,
      "body": JSON.stringify(event.formData),
      "headers": {
        "content-type": "application/json",
      },
    });

    const data_rx = await res.json() as Record<string, string>;
		console.log(data_rx);
		if (data_rx.location) {
			window.location.href = data_rx.location;
		}
  });
})();
