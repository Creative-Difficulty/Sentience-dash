# Sentience dashboard

![Sentience dashboard](sentience.png)

This is the dashboard used to display all information gathered by the sentience bot. It uses SvelteKit and the IBM carbon components for Svelte as well as the carbon charts for svelte library. It also holds a conversation explorer page with data on all recorded messages and highlights them into topics (classified by `topic-sorter`) and a User data page with facts the the `fact-extractor` worker has extracted about users.
The site is not completely finished just yet, and is bit janky on smaller screens, as I have struggeled to get carbon components and carbon charts to accept anyhting other than fixed pixel values for size.

## Installation

It is dockerized, however not included in the docker-compose with the main sentience workers, as it lives in a different repository.
The docker installation exposes port 3000 for the site, visit `localhost:3000` on your machine to access it.

Make sure to pass in the `DATABASE_URL` to docker when running the image, otherwise the site will not work properly.

## Contribution

Please refer to the guide in the main sentience-workers repository.

## Credits

The owl drawing, which is displayed in the bottom left corner, as well as used as a favicon, was created by Sylvan Franklin: <https://sylvanfranklin.com>, provided by him and used with his permission.
