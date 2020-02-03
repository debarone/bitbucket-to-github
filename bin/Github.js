const request = require("request-promise");
const path = require("path");
const exec = require("util").promisify(require("child_process").exec);

class Github {
  /**
   * Create repositories on Github an array
   * of Bitbucket repositories
   *
   * @param {Array} repositories
   * @returns {Array} of successfully created `repositories`
   */
  static async createRepositories(repositories) {
    // keep track of which repos have failed to be created on Github
    const createdRepos = [];

    for(let i = 0; i < repositories.length; i++) {
      let success = this.createRepository(repositories[i]);

      if (success) {
        createdRepos.push(repositories[i]);
      }
    }

    return createdRepos;
  }

  /**
   * Check whether repository exists on Github.
   *
   * @param {Object} repository single Bitbucket repo resource
   * @returns {String} success status
   */
  static async checkRepository(repository) {
    try {
      // check the users repos
      let json_repos = await request.get({
        url: "https://api.github.com/user/repos",
        headers: {
            "User-Agent": "Transfer CI",
            Authorization: `token ${process.env.GITHUB_COMMON_CREDS_PSW}`
        },
        json: true
      });

      var res = "no_exists"
      json_repos.forEach(r => {
        if (repository.slug == r.name) {
          res = "exists";
        }
      });

      return res;
    } catch (e) {
      // something went wrong, log the message
      // but don't kill the script
      const errors = e.error.errors;

      for (let i = 0; i < errors.length; i++) {
        console.log(
            "Failed checking repository",
            repository.slug + ",",
            errors[i].message + "."
        );
      }

      return "exception";
    }

    return true;
  }

  /**
   * Create a new repository on Github.
   *
   * @param {Object} repository single Bitbucket repo resource
   * @returns {Boolean} success status
   */
  static async createRepository(repository) {
    try {
      let check_exists = await this.checkRepository(repository);

      if (check_exists == "no_exists") {
        await request.post({
          url: "https://api.github.com/user/repos",
          body: {
            name: repository.slug,
            description: repository.description,
            private: repository.is_private,
            has_issues: repository.has_issues,
            has_wiki: repository.has_wiki
          },
          headers: {
            "User-Agent": "Transfer CI",
            Authorization: `Bearer ${process.env.GITHUB_COMMON_CREDS_PSW}`
          },
          json: true
        })
      } else if (check_exists == "exception") {
        throw new Error('\t ..! check repo failed for ' + repository.slug);
      }

      return true
    } catch (e) {
      // something went wrong, log the message
      // but don't kill the script
      console.log(
        "Failed creating repository ", 
        repository.slug + ", " + e
      );

      return false;
    }

    return true;
  }

  static async pushRepositories(repositories) {
    // keep track of which repos have failed to be pushed to Github
    const successfulRepos = [];

    for (let i = 0; i < repositories.length; i++) {
      // create the repository
      let success = await Github.pushRepository(repositories[i]);

      // keep track of which repos were pushed for reporting
      if (success) {
        console.log("\t... pushed repository for", repositories[i].slug);
        successfulRepos.push(repositories[i]);
      }
    }
    return successfulRepos;
  }

  /**
   * Push to the repository a new repository on Github.
   *
   * @param {Object} repository single Bitbucket repo resource
   * @returns {Bolean} success status
   */
  static async pushRepository(repository) {
    // set upstream
    // push

    // path to the local repository
    const pathToRepo = path.resolve(
      __dirname,
      "../repositories/",
      repository.slug
    );

    // initialize a folder and git repo on this machine
    // add Bitbucket as a remote and pull
    let commands = ` cd ${pathToRepo} \
      && git init \
      && git remote set-url origin https://${
        process.env.GITHUB_COMMON_CREDS_USR
      }:${process.env.GITHUB_COMMON_CREDS_PSW}@github.com/${
        process.env.GITHUB_COMMON_CREDS_USR
      }/${
        repository.slug
      }.git \
      && git push origin master`;
    try {
      // initialize repo
      await exec(commands);

      return true;
    } catch (e) {
      console.log(e);
      console.log("\t..! couldn't push repository", repository.slug);
    }

    return false;
  }
}

module.exports = Github;
