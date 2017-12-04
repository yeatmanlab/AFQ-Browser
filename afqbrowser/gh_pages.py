import os
import os.path as op
import getpass
import tempfile
import pandas as pd

import github as gh
import git


def upload(target, repo_name, uname=None, upass=None):
    """
    Upload an assembled AFQ-Browser site to a github pages website.

    Parameters
    ----------
    target : str
        Local path to the file-system location where the AFQ-Browser files are
        (need to run `assemble` before running this function)
    repo_name : str
        The website will be at https://<username>.github.io/<repo_name>
    uname : str, optional
        Github user-name
    upass : str, optional
        Github password

    """
    # Get all the files that will be committed/pushed
    file_list = []
    client_folder = op.join(target, 'client')
    for path, dirs, files in os.walk(client_folder):
        for f in files:
            file_list.append(os.path.abspath(op.join(path, f)))
    # Get credentials from the user
    if uname is None:
        uname = getpass.getpass("Github user-name?")
    if upass is None:
        upass = getpass.getpass("Github password?")

    # Create the remote repo on Github (use PyGithub)
    g = gh.Github(uname, upass)
    u = g.get_user()
    remote = u.create_repo(repo_name)
    # Create the local repo using GitPython:
    r = git.Repo.init(client_folder)
    # Add all of the files to the repo's gh-pages branch
    r.index.add(file_list)
    r.index.commit("Commit everything")
    # Add a .nojekyll file
    f = open(op.join(client_folder, '.nojekyll'), 'w')
    f.close()
    r.index.add([os.path.abspath(f.name)])
    r.index.commit("Add nojekyll file")
    # Push to Github
    branch = r.create_head("gh-pages")
    branch.checkout()
    r.create_remote("origin", remote.clone_url)
    o = r.remote("origin")
    o.push("gh-pages")

    # Strangely, that last slash is crucial so that this works as a link:
    site_name = "https://" + uname + ".github.io/" + repo_name + "/"

    # Next, we deposit to afqvault
    afqvault_repo = g.get_repo('afqvault/afqvault')
    # If you already have a fork, the following gives you the fork.
    # Otherwise, it creates the fork:
    my_fork = u.create_fork(afqvault_repo)

    # Create a local copy of your fork:
    tdir = tempfile.TemporaryDirectory()
    av_repo = git.Repo.init(op.join(tdir.name, 'afqvault'))
    origin = av_repo.create_remote('origin', my_fork.clone_url)
    origin.fetch()
    av_repo.create_head('master', origin.refs.master)
    av_repo.heads.master.set_tracking_branch(origin.refs.master)
    av_repo.heads.master.checkout()
    origin.pull()

    # Edit the manifest file with your information:
    manifest_fname = op.join(tdir.name, 'afqvault', 'manifest.csv')
    manifest = pd.read_csv(manifest_fname,
                           index_col=0)
    manifest = manifest.append(pd.DataFrame(data=dict(username=[uname],
                                            repository_name=[repo_name])))

    # Commit this change:
    av_repo.index.add([os.path.abspath(manifest_fname)])
    av_repo.index.commit("Adds %s" % site_name)
    # Push it to your forks master branch
    origin.push("master")

    # Then, we create the PR against the central repo:
    afqvault_repo.create_pull("Adds %s" % site_name,
                              "Created automatically by afqbrowser-publish",
                              "master",
                              "%s:master" % uname)

    return site_name
