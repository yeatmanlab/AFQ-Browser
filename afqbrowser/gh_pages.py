import os
import os.path as op
import getpass
import tempfile
import pandas as pd

import github as gh
import git


def upload(target, repo_name, uname=None, upass=None, token=None, org=None):
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
        GitHub user-name
    upass : str, optional
        GitHub password
    org : str, optional
        When provided, this means that the website will be at:
        https://<org>.github.io/<repo_name>. Defaults to use the user-name.
    """
    # Get all the files that will be committed/pushed
    file_list = []
    client_folder = op.join(target, 'client')
    for path, dirs, files in os.walk(client_folder):
        for f in files:
            file_list.append(os.path.abspath(op.join(path, f)))
    # Get credentials from the user
    if uname is None:
        uname = getpass.getpass("GitHub user-name? ")
    if not any([upass, token]):
        upass = getpass.getpass("GitHub password (leave blank if using 2FA "
                                "and personal access token)? ")
        if not upass:
            token = getpass.getpass("GitHub personal access token? ")
            print('If prompted again for username and password, use your '
                  'access token as the password.')

    login_uname = uname if token is None else token

    # Create the remote repo on GitHub (use PyGithub)
    g = gh.Github(login_uname, upass)
    u = g.get_user()
    if org is not None:
        gh_org = g.get_organization(org)
        remote = gh_org.create_repo(repo_name)
    else:
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
    # Push to GitHub
    branch = r.create_head("gh-pages")
    branch.checkout()
    o = r.create_remote("origin", remote.clone_url)
    assert o.exists()

    o.push("gh-pages")

    # Strangely, that last slash is crucial so that this works as a link:
    if org is not None:
        site_name = "https://" + org + ".github.io/" + repo_name + "/"
    else:
        site_name = "https://" + uname + ".github.io/" + repo_name + "/"

    # Next, we deposit to afqvault
    afqvault_repo = g.get_repo('afqvault/afqvault')
    # If you already have a fork, the following gives you the fork.
    # Otherwise, it creates the fork:
    my_fork = u.create_fork(afqvault_repo)

    # Create a local copy of your fork:
    tdir = tempfile.mkdtemp()
    av_repo = git.Repo.init(op.join(tdir, 'afqvault'))
    origin = av_repo.create_remote('origin', my_fork.clone_url)
    origin.fetch()
    av_repo.create_head('master', origin.refs.master)
    av_repo.heads.master.set_tracking_branch(origin.refs.master)
    av_repo.heads.master.checkout()
    origin.pull()

    # We create a new branch every time we do this, so that we can PR
    # More than one time
    branch_name = uname + "/" + repo_name + r.commit().hexsha
    branch = av_repo.create_head(branch_name)
    branch.checkout()

    # Edit the manifest file with your information:
    manifest_fname = op.join(tdir, 'afqvault', 'manifest.csv')
    manifest = pd.read_csv(manifest_fname,
                           index_col=0)
    shape = manifest.shape
    manifest = manifest.append(pd.DataFrame(data=dict(
        username=[uname if org is None else org],
        repository_name=[repo_name])))

    # Deduplicate -- if this site was already uploaded, we're done!
    manifest = manifest.drop_duplicates()
    manifest.to_csv(manifest_fname)
    # Otherwise, we need to make a PR against afqvault
    if manifest.shape != shape:
        # Commit this change:
        av_repo.index.add([os.path.abspath(manifest_fname)])
        av_repo.index.commit("Adds %s" % site_name)
        # Push it to that branch on your fork
        origin.push(branch_name)

        # Then, we create the PR against the central repo:
        afqvault_repo.create_pull("Adds %s" % site_name,
                                  "Auto-created by afqbrowser-publish",
                                  "master",
                                  "%s:%s" % (uname, branch_name))

    return site_name
