import os
import os.path as op
import getpass

from github import Github
import git


def upload(target, repo_name, uname=None, upass=None):
    """
    Upload an assembled AFQ-Browser site to a github pages website

    Parameters
    ----------
    target : str
        Local path to the file-system location where
    repo_name : str
        The website will be at https://<username>.github.io/<repo_name>
    uname : str, optional
        Github user-name
    upass : str, optional
        Github password

    """
    # Get all the files that will be committed/pushed
    file_list = []
    target = op.join(target, 'AFQ-browser', 'client')
    for path, dirs, files in os.walk(target):
        for f in files:
            file_list.append(os.path.abspath(op.join(path, f)))
    # Get credentials from the user
    if uname is None:
        getpass.getpass("Github user-name?")
    if upass is None:
        getpass.gepass("Github password?")

    # Create the remote repo on Github (use PyGithub)
    g = Github(uname, upass)
    u = g.get_user()
    remote = u.create_repo(repo_name)
    # Create the local repo

    # Add all of the files to the repo's gh-pages branch
    r.index.add(file_list)
    r.index.commit("Commit everything")
    # Add a .nojekyll file
    f = open(op.join(target, '.nojekyll'))
    r.index.add([os.path.abspath(op.join(path, f))])
    r.index.commit("Add nojekyll file")
    # Push to Github
