# puppet-orange

`puppet-orange` is a nodeJS Puppeteer script. Its purpose is to check for the eligibility of a postal address to the Orange fiber offer.
Given an address, the script validates the status of this address on the Orange eligibility website.

# Install & run

```shell
git clone git@github.com:GLabat/puppet-orange.git
cd puppet-orange
npm i
npm start <address>
```

# Debug

You can pass the character 'd' as second argument of the `start` script. This would activate the debug mode:

* run Chrome in non-headless mode
* add capture of remote browser console
