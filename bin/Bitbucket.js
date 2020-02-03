const request = require("request-promise");
const path = require("path");
const exec = require("util").promisify(require("child_process").exec);

class Bitbucket {
  /**
   * Gets all of a user's bitbucket repositories
   *
   * @returns {Array} list of repositories from Bitbucket
   */
  static async getRepositories() {
    // use this to compile a list of our repos
    const repoList = [];

    // a page of repos we get back from Bitbucket
    let response;

    // page counter for api requests
    let currentPage = 1;
    let url = "https://api.bitbucket.org/2.0/repositories/" +
    process.env.BITBUCKET_ACCOUNT_ID + "/?q=" +
    "project.key=%22" + process.env.BITBUCKET_PROJECT + "%22" +
    "+AND+slug~%22" + process.env.REPOSITORY + "%22";

    console.log("URL: " + url);

    do {
      // make a request to the Bitbucket API
      response = await request(
        url,
        {
          auth: {
            // fill in Bitbucket credentials in .env file
            user: process.env.BITBUCKET_USERNAME,
            password: process.env.BITBUCKET_PASSWORD
          },
          json: true
        }
      );

      // compile the repos we just got into an array
      repoList.push(...response.values);

      // make sure we query the next page next time we call the API
      currentPage++;

      // while there's another page to hit, loop
    } while (response.next);

    return repoList;
  }

  /**
   * Clones repositories from Bitbucket
   * into a local folder
   *
   * @param {Array} repositories
   */
  static async pullRepositories(repositories) {
    const successfulRepos = [];
    for (let i = 0; i < repositories.length; i++) {
      // create the repository
      let success = await Bitbucket.pullRepository(repositories[i]);

      // we don't want to try to push to repos that errored out
      if (success) {
        console.log("\t... pulled repository for", repositories[i].slug);
        successfulRepos.push(repositories[i]);
      }
    }
    return successfulRepos;
  }

  /**
   * Clone a new repository from Bitbucket.
   *
   * @param {Object} repository single Bitbucket repo resource
   * @returns {Bolean} success status
   */
  static async pullRepository(repository) {
    // path to the local repository
    const pathToRepo = path.resolve(
      __dirname,
      "../repositories/",
      repository.slug
    );

    // initialize a folder and git repo on this machine
    // add Bitbucket as a remote and pull
    let repo_href = repository.links.clone[0].href.replace(
      /\w+(?=\@)/, `${process.env.BITBUCKET_USERNAME}:${process.env.BITBUCKET_PASSWORD}`
    );

    let commands = `if [ -d ${pathToRepo} ]; then rm -rf ${pathToRepo}; fi \
      && mkdir ${pathToRepo} \
      && cd ${pathToRepo} \
      && git init \
      && git remote add origin ${repo_href} \
      && git pull origin master`;
    try {
      // initialize repo
      await exec(commands);

      return true;
    } catch (e) {
      console.log("\t..! couldn't pull repository: ", repository.slug + " - " + e);
    }

    return false;
  }
}

module.exports = Bitbucket;
