import os
import os.path as op
from glob import glob
import shutil
import scipy.io as sio
import pandas as pd
import numpy as np
import afqbrowser as afqb

# Shim for Python2/Python3:
try:
    from http.server import SimpleHTTPRequestHandler
    import socketserver
except ImportError:
    from SimpleHTTPServer import SimpleHTTPRequestHandler
    import SocketServer as socketserver


def tracula2nodes(stats_dir, out_path=None):
    """
    Create a nodes table from a TRACULA `stats` directory.

    Read data processed with TRACULA [1]_ and generate an AFQ-browser compliant
    nodes table.

    Parameters
    ----------
    stats_dir : str
        Full path to a directory containing stats results from TRACULA
        processing.

    out_path : str, optional
        Full path to directory where the nodes table will be saved.

    Notes
    -----
    .. [1] Automated probabilistic reconstruction of white-matter pathways in
           health and disease using an atlas of the underlying anatomy. Yendiki
           A, Panneck P, Srinivasan P, Stevens A, Zöllei L, Augustinack J, Wang
           R, Salat D, Ehrlich S, Behrens T, Jbabdi S, Gollub R and Fischl B
           (2011). Front. Neuroinform. 5:23. doi: 10.3389/fninf.2011.00023
    """
    ll = glob(op.join(stats_dir, '*.txt'))

    tracks = []
    for l in ll:
        tt = '.'.join(op.split(l)[-1].split('.')[:2])
        if not (tt.startswith('rh') or tt.startswith('lh')):
            tt = tt.split('.')[0]
        tracks.append(tt)

    tracks = list(set(tracks))

    metrics = []
    for l in ll:
        metrics.append((op.splitext(op.split(l)[-1])[0]).split('.')[-1])
    metrics = [l for l in list(set(metrics)) if l not in ['mean', 'inputs']]

    for t in tracks:
        first_metric = True
        for m in metrics:
            if first_metric:
                fname = op.join(stats_dir, t + '.avg33_mni_bbr.' + m + '.txt')
                df_nodes = pd.read_csv(fname, delimiter=' ')
                df_nodes = df_nodes.drop(
                    filter(lambda x: x.startswith('Unnamed'),
                           df_nodes.columns),
                    axis=1)
                n_nodes, n_subs = df_nodes.shape
                re_data = df_nodes.as_matrix().T.reshape(n_nodes * n_subs)
                re_nodes = np.tile(np.arange(n_nodes), n_subs)
                re_subs = np.concatenate(
                    [[s for i in range(n_nodes)] for s in df_nodes.columns])
                re_track = np.repeat(t, n_subs * n_nodes)
                re_df = pd.DataFrame({'subjectID': re_subs,
                                      'tractID': re_track,
                                      'nodeID': re_nodes,
                                      m: re_data})
                first_metric = False
            else:
                fname = op.join(stats_dir, t + '.avg33_mni_bbr.' + m + '.txt')
                re_data = df_nodes.as_matrix().T.reshape(n_nodes * n_subs)
                re_df[m] = re_data

    if out_path is None:
        out_path = '.'

    nodes_fname = op.join(out_path, 'nodes.csv')
    re_df.to_csv(nodes_fname, index=False)

    return nodes_fname


def afq_mat2tables(mat_file_name, subject_ids=None, stats=None,
                   out_path=None):
    """
    Create a nodes table and a subjects table from an AFQ `.mat` file.

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

    out_path : str, optional
        Full path to the CSV file to be saved as output. Default: pwd.

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
    meta_csv_fname = op.join(out_path, 'subjects.csv')
    meta_df.to_csv(meta_csv_fname)

    return nodes_fname, meta_fname


def copy_and_overwrite(from_path, to_path):
    """Helper function to copy and overwrite."""
    if op.exists(to_path):
        shutil.rmtree(to_path)
    shutil.copytree(from_path, to_path)


def assemble(source, target=None, metadata=None):
    """
    Spin up an instance of the AFQ-Browser with data provided as a mat file.

    Parameters
    ----------
    source : str
        Path to a mat-file containing the AFQ data structure or to a TRACULA
        stats folder.

    target : str, optional.
        Path to a file-system location to create this instance of the
        browser in. Default: pwd.

    metadata : str, optional.
        Path to an input csv metadata file. This file requires a "subjectID"
        column to work. If a file is provided, it will overwrite metadata
        provided through other. Default: read metadata from AFQ struct, or
        generate a metadata table with just a "subjectID" column (e.g., for
        TRACULA).
    """
    if target is None:
        target = '.'
    site_dir = op.join(target, 'AFQ-browser')
    # This is where the template is stored:
    data_path = op.join(afqb.__path__[0], 'site')
    copy_and_overwrite(data_path, site_dir)
    if source.endswith('.mat'):
        # We have an AFQ-generated mat-file on our hands:
        nodes_fname, meta_fname = afq_mat2tables(
            source,
            out_path=op.join(site_dir, 'client', 'data'))
    else:
        # Assume we got a TRACULA stats path:
        nodes_fname = tracula2nodes(source)
        if metadata is None:
            nodes = pd.read_csv(nodes_fname)
            subjects = nodes["subjectID"].unique()
            meta_df = pd.DataFrame(dict(subjectID=subjects))
            out_path = op.join(site_dir, 'client', 'data')
            meta_csv_fname = op.join(out_path, 'subjects.csv')
            meta_df.to_csv(meta_csv_fname)

    if metadata is not None:
        # Provided metadata should overwrite the metadata in the mat file
        # when it is provided:
        shutil.copyfile(metadata, meta_fname)


def run(target=None, port=8080):
    """
    Run a webserver for AFQ-browser.

    Parameters
    ----------
    target : str
        Full path to the root folder where AFQ-browser files are stored.

    port : int
        Which port to run the server on.
    """
    if target is None:
        target = '.'
    site_dir = op.join(target, 'AFQ-browser', 'client')
    os.chdir(site_dir)
    Handler = SimpleHTTPRequestHandler
    success = False
    while not success:
        try:
            httpd = socketserver.TCPServer(("", port), Handler)
            success = True
        except OSError:
            port = port + 1
    print("Serving AFQ-browser on port", port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
