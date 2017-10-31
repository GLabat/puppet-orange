# puppet-orange

`puppet-orange` is a NodeJS Puppeteer script. Its purpose is to check for the eligibility of a postal address to the Orange fiber offer.
Given an address, the script validates the status of this address on the Orange eligibility website.
> Minimal NodeJs version: 8 (use of `util.promisify`).

## Install & run

```shell
git clone git@github.com:GLabat/puppet-orange.git
cd puppet-orange
npm i
npm start '<address>'
```

> To run in Docker, `docker run -it -v "$(pwd)":/app glabat:puppet-orange npm start '<address>'`

## Return code

The script will return the following codes:

* Bad usage: `99`
* Eligible: `0`
* Not yet eligible: `1`
* Not eligible: `2`

## Debug

You can pass the character 'd' as second argument of the `start` script. This would activate the debug mode:

* run Chrome in non-headless mode
* add capture of remote browser console
* add debug logs

## Build the Docker image

`docker build . -t glabat:puppet-orange`