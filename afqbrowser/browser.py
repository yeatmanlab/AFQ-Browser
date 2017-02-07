import os
import os.path as op
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
    from SimpleHTTPRequestHandler import SimpleHTTPServer
    import SocketServer as socketserver


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


def assemble(source, target=None):
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
    if target is None:
        target = '.'
    site_dir = op.join(target, 'AFQ-browser')
    # This is where the template is stored:
    data_path = op.join(afqb.__path__[0], 'site')
    shutil.copytree(data_path, site_dir)
    # Take in a mat-file as input and create the file
    nodes_fname, meta_fname = mat2tables(
        source,
        out_path=op.join(site_dir, 'client', 'data'))


def run(target=None, port=8888):
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
