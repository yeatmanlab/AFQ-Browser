import os.path as op
import shutil

import scipy.io as sio
import pandas as pd
import numpy as np
from flask import Flask, render_template, send_from_directory

import afqbrowser as afqb


def data_path(data_hash=''):
    return op.join(op.dirname(afqb.__path__[0]), 'data', data_hash)


def site_path():
    return op.join(afqb.__path__[0], 'site', 'client')


def mat2tables(mat_file_name, subject_ids=None, stats=None,
               out_path=None):
    """
    Create a nodes table and a subjects table from an AFQ `.mat` file

    Parameters
    ----------
    mat_file_name : str
        Full path to an AFQ-processed mat-file

    subject_ids : list, optional
        Identifiers for the subjects.
        Default: ['subject_001', 'subject_002,' ...]

    stats : list, optional
        List of keys for statistics to pull from the AFQ data.
        Default: pull out all of the statistics that are in the mat file.

    out_file : str
        Full path to the CSV file to be saved as output

    Returns
    -------
    tuple: paths to the files that get generated: (nodes, subjects)
    """
    afq = sio.loadmat(mat_file_name, squeeze_me=True)['afq']
    vals = afq['vals'].item()
    tract_ids = afq['fgnames'].item()

    n_tracts = len(tract_ids)
    if stats is None:
        stats = list(vals.dtype.fields.keys())
    columns = ['subjectID', 'tractID', 'nodeID']
    columns = columns + stats
    df = pd.DataFrame(columns=columns)
    n_subjects, nodes_per_tract = vals[stats[0]].item()[0].shape

    # Check if subject ids is defined in the afq structure
    if subject_ids is None:
        if 'sub_ids' in afq.dtype.names and len(afq['sub_ids'].item()):
            subject_ids = [str(x) for x in afq['sub_ids'].item()]
        else:
            if n_subjects > 1000:
                subject_ids = ['subject_%05d' % i for i in range(n_subjects)]
            elif n_subjects > 100:
                subject_ids = ['subject_%04d' % i for i in range(n_subjects)]
            elif n_subjects > 10:
                subject_ids = ['subject_%03d' % i for i in range(n_subjects)]
            else:
                subject_ids = ['subject_%02d' % i for i in range(n_subjects)]

    subject_ids = np.array(subject_ids)

    # Loop over subjects
    for subject in range(len(subject_ids)):
        sid = subject_ids[subject]
        # If the subject ID could be interperted as a number:
        if isinstance(sid, int) or sid.isdigit():
            # Prepend an "s" so that sorting works on the IDs in the browser:
            sid = "s" + sid
        # Loop over tracts
        for tract in range(n_tracts):
            # Making a subject and tract specific dataframe
            subj_df = pd.DataFrame(
                columns=['subjectID', 'tractID', 'nodeID'],
                data=np.array([[sid] * nodes_per_tract,
                              [tract_ids[tract]] * nodes_per_tract,
                              np.arange(nodes_per_tract)]).T)
            # We're looping over the desired stats (eg fa, md) and adding them
            # to the subjects dataframe
            for stat in stats:
                scalar = vals[stat].item()[tract][subject, :]
                subj_df[stat] = scalar
            # The subject's dataframe for this tract is now appended to the
            # whole dataframe here:
            df = df.append(subj_df)

    # Set output path from the input kwarg:
    if out_path is None:
        out_path = '.'

    nodes_fname = op.join(out_path, 'nodes.csv')
    # Write to file
    df.to_csv(nodes_fname, index=False)

    # Create metadata
    metadata = afq['metadata'].item()

    meta_df1 = pd.DataFrame({"subjectID": subject_ids},
                            index=range(len(subject_ids)))
    # Metadata has mixed types, and we want to preserve that
    # going into the DataFrame. Hence, we go through a dict:
    metadata_for_df = {k: v for k, v in
                       zip(metadata.dtype.names, metadata.item())}

    meta_df2 = pd.DataFrame(metadata_for_df)

    meta_df = pd.concat([meta_df1, meta_df2], axis=1)
    meta_fname = op.join(out_path, 'subjects.json')
    meta_df.to_json(meta_fname, orient='records')

    return nodes_fname, meta_fname


def copy_and_overwrite(from_path, to_path):
    if op.exists(to_path):
        shutil.rmtree(to_path)
    shutil.copytree(from_path, to_path)


def assemble(source, target=None, id=None):
    """
    Spin up an instance of the AFQ-Browser with data provided as a mat file

    Parameters
    ----------
    source : str
        Path to a mat-file containing the AFQ data structure.

    target : str
        Path to a file-system location to create this instance of the
        browser in
    """
    target = target or site_path()
    nodes_fname, meta_fname = mat2tables(source, out_path=data_path())


def run(target=None, port=8080, name=__name__, debug=False,
        title="AFQ Browser"):
    target = target or op.abspath(op.join(afqb.__path__[0], '..', 'data'))
    site_dir = op.join(afqb.__path__[0], 'site', 'client')

    app = Flask(name, template_folder=site_dir, static_path=site_dir)

    @app.route("/")
    @app.route("/index.html")
    def index():
        return render_template('index.html', **{
            'title': 'AFQ Browser',
            'DATA_URL': 'data'
        })

    @app.route("/data/<path:path>")
    def data_files(path):
        print(data_path())
        return send_from_directory(data_path(), path)

    @app.route("/<path:path>")
    def static_files(path):
        return send_from_directory(site_dir, path)

    @app.route('/index.html')
    def static_page(page_name):
        return render_template('%s.html' % page_name)

    app.run(debug=True, port=port)
