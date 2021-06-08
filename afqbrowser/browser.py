"""

afqbrowser.browser: data munging for AFQ-Browser

"""
import os
import os.path as op
import errno
import warnings
from glob import glob
import json
import shutil
from collections import OrderedDict

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


MNI_AFF = np.array([[1., 0., 0., -98.],
                    [0., 1., 0., -134.],
                    [0., 0., 1., -72.],
                    [0., 0., 0., 1.]])


def _extract_params(afq):
    """
    Helper function to extract a params dict from the AFQ mat file
    """
    afq_params = afq['params']
    params_dict = {k: afq_params.item()[k].tolist() for k in
                   afq_params.item().dtype.names}

    params_dict['track'] = {k: params_dict['track'][k].tolist() for k in
                            params_dict['track'].dtype.names}

    for k in params_dict['track'].keys():
        if hasattr(params_dict['track'][k], 'tolist'):
            params_dict['track'][k] = params_dict['track'][k].tolist()

    for k in params_dict.keys():
        if hasattr(params_dict[k], 'tolist'):
            params_dict[k] = params_dict[k].tolist()

    # Some newer version of AFQ have scan params:
    if 'scanparams' in afq.dtype.names:
        scan_params = afq['scanparams'].item()
        scan_dict = {k: scan_params[k].tolist() for k in
                     scan_params.dtype.names}
        for k in scan_dict.keys():
            if hasattr(scan_dict[k], 'tolist'):
                scan_dict[k] = scan_dict[k].tolist()

        scan_dict = {k: scan_params[k].tolist() for k in
                     scan_params.dtype.names}
        for k in scan_dict.keys():
            if hasattr(scan_dict[k], 'tolist'):
                scan_dict[k] = scan_dict[k].tolist()

    # Older versions of AFQ don't have the scan params:
    else:
        scan_dict = {}

    params = {'analysis_params': params_dict, 'scan_params': scan_dict}
    return params


def _create_metadata(subject_ids, meta_fname):
    """Helper function to create a minimal metadata file."""
    meta_df = pd.DataFrame({"subjectID": subject_ids},
                           index=range(len(subject_ids)))
    meta_df.to_csv(meta_fname)


def _copy_nodes_table(nodes_table_fname, out_path=None, metadata=None,
                      streamlines=None):
    """
    Replace default `nodes.csv` with user provided file.

    Parameters
    ----------
    nodes_table_fname : str
        Full path to user-supplied AFQ-Browser nodes CSV file

    out_path : str, optional
        Full path to directory where the nodes table will be saved. If not
        provided will assume current working directory.

    metadata : str, optional
        Full path to a file with user-supplied metadata. If not provided
        a metadata file will be generated using subjectIDs in the nodes table.

    streamlines : str, optional
        Full path to a file with user-supplied streamlines. If not provided
        the default streamline file consisting of twenty tracts, each with a
        core fiber and a set of sub-sampled streamlines, each with 100 nodes
        from an examplar subject will be utilized as a representative anatomy.

    Returns
    -------
    tuple: paths to the files that get generated:
        nodes_fname, meta_fname, streamlines_fname
    """
    if not op.exists(nodes_table_fname):
        raise FileNotFoundError(errno.ENOENT,
                                os.strerror(errno.ENOENT),
                                nodes_table_fname)

    if out_path is None:
        out_path = '.'

    nodes_fname = op.join(out_path, 'nodes.csv')
    shutil.copy(nodes_table_fname, nodes_fname)

    meta_fname = op.join(out_path, 'subjects.csv')

    if metadata is None:
        nodes_df = pd.read_csv(nodes_fname)
        _create_metadata(nodes_df.subjectID.unique(), meta_fname)
    else:
        shutil.copy(metadata, meta_fname)

    streamlines_fname = op.join(out_path, 'streamlines.json')

    if streamlines is None:
        warnings.warn('Using default anatomy')
    else:
        shutil.copy(streamlines, streamlines_fname)

    return nodes_fname, meta_fname, streamlines_fname


def _validate(nodes_fname, meta_fname, streamlines_fname):
    """
    Run checks to ensure requirements and warns of inconsistencies.

    Parameters
    ----------
    nodes_fname  : str
        Full path to nodes table CSV file

    meta_fname : str
        Full path to metadata CSV file

    streamlines_fname : str
        Full path to streamlines JSON file

    Returns
    -------
    list : validation_errors
    """
    nodes_df = pd.read_csv(nodes_fname)
    required_columns = ['subjectID', 'tractID', 'nodeID']

    validation_errors = []

    for column in required_columns:
        if column not in nodes_df.columns:
            if column.lower() not in [c.lower() for c in nodes_df.columns]:
                validation_errors.append(ValueError(
                    f'Nodes table columns are case sensitive: {column}'))
            else:
                validation_errors.append(ValueError(
                    f'Nodes table missing required column: {column}'))

    meta_df = pd.read_csv(meta_fname)

    # check subjcts consistent
    if 'subjectID' not in meta_df.columns:
        validation_errors.append(ValueError(
            'Metadata file missing required column: subjectID'))

    if set(nodes_df.subjectID.unique()) != set(meta_df.subjectID):
        diff = set(nodes_df.subjectID.unique()) ^ set(meta_df.subjectID)
        warnings.warn('Metadata and Nodes table subjects are inconsistent: '
                      f'{diff}\n Some subjects may not appear.')

    with open(streamlines_fname) as fp:
        streamlines = json.load(fp)

    # check tracts consistent
    if set(nodes_df.tractID.unique()) != set(streamlines.keys()):
        diff = set(nodes_df.tractID.unique()) ^ set(streamlines.keys())
        warnings.warn('Streamlines and Nodes table tracts are inconsistent: '
                      f'{diff}\n Some bundles may not appear.')

    # check nodes consistent
    for tractID in streamlines.keys():
        if 'coreFiber' not in streamlines[tractID].keys():
            validation_errors.append(ValueError(
                f'Streamlines {tractID} missing required key: coreFiber'))

        tract = nodes_df.loc[nodes_df.tractID == tractID]
        tract_num_nodes = len(tract.nodeID.unique())

        for streamlineID in streamlines[tractID].keys():
            streamline_num_nodes = len(streamlines[tractID][streamlineID])
            if tract_num_nodes != streamline_num_nodes:
                validation_errors.append(ValueError(
                    f'Streamlines {tractID} {streamlineID} and Nodes tables'
                    'nodes inconsistent length'))

    return validation_errors


def tracula2nodes(stats_dir, out_path=None, metadata=None, params=None):
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

    metadata : str, optional
        Full path to a file with user-supplied metadata. This has to be a csv
        file with column headers in the first row, including a column named
        "subjectID". For an example, see the 'data/subjects.csv' that comes
        with the software.

    params : str, optional
        Full path to a params file that describes the analysis and the scan
        params. This is a json file that has keys "analysis_params" and
        "scan_params" that can be filled with a dict with parameters pertaining
        to the analysis and to the scanned data. The fields used by AFQ are
        described in:
        `https://github.com/jyeatman/AFQ/blob/master/functions/AFQ_Create.m`

    Returns
    -------
    tuple: paths to the files that get generated:
        nodes_fname, meta_fname, streamlines_fname, params_fname

    Notes
    -----
    .. [1] Automated probabilistic reconstruction of white-matter pathways in
           health and disease using an atlas of the underlying anatomy. Yendiki
           A, Panneck P, Srinivasan P, Stevens A, Zollei L, Augustinack J, Wang
           R, Salat D, Ehrlich S, Behrens T, Jbabdi S, Gollub R and Fischl B
           (2011). Front. Neuroinform. 5:23. doi: 10.3389/fninf.2011.00023
    """
    txt_files = glob(op.join(stats_dir, '*.txt'))

    tracks = []
    metrics = []
    for txt_file in txt_files:
        tt = '.'.join(op.split(txt_file)[-1].split('.')[:2])
        if not (tt.startswith('rh') or tt.startswith('lh')):
            tt = tt.split('.')[0]
        tracks.append(tt)
        metrics.append((op.splitext(op.split(txt_file)[-1])[0]).split('.')[-1])

    tracks = list(set(tracks))
    metrics = [metric
               for metric in list(set(metrics))
               if metric not in ['mean', 'inputs']]

    streamlines = OrderedDict()
    dfs = []

    for tt in tracks:
        coords_file = tt + '.avg33_mni_bbr.coords.mean.txt'
        cc = np.loadtxt(op.join(stats_dir, coords_file))
        # We apply the MNI affine, to get back to AC/PC space in mm:
        coords = np.dot(cc, MNI_AFF[:-1, :-1].T) + MNI_AFF[:-1, -1][None, :]
        streamlines[tt] = {'coreFiber': coords.tolist()}

        first_metric = True

        for m in metrics:
            fname = op.join(stats_dir, tt + '.avg33_mni_bbr.' + m + '.txt')
            df_metric = pd.read_csv(fname, delimiter=' ')
            df_metric = df_metric.drop(
                filter(lambda x: x.startswith('Unnamed'),
                       df_metric.columns),
                axis=1)
            n_nodes, n_subjects = df_metric.shape
            re_data = df_metric.values.T.reshape(n_nodes * n_subjects)

            if first_metric:
                re_nodes = np.tile(np.arange(n_nodes), n_subjects)
                re_subs = np.concatenate(
                    [[s for i in range(n_nodes)] for s in df_metric.columns])
                re_track = np.repeat(tt, n_subjects * n_nodes)
                re_df = pd.DataFrame({'subjectID': re_subs,
                                      'tractID': re_track,
                                      'nodeID': re_nodes,
                                      m: re_data})
                first_metric = False
            else:
                re_df[m] = re_data

        dfs.append(re_df)

    nodes_df = pd.concat(dfs)

    if out_path is None:
        out_path = '.'

    nodes_fname = op.join(out_path, 'nodes.csv')
    nodes_df.to_csv(nodes_fname, index=False)

    meta_fname = op.join(out_path, 'subjects.csv')

    if metadata is None:
        _create_metadata(df_metric.columns, meta_fname)

    else:
        shutil.copy(metadata, meta_fname)

    streamlines_fname = op.join(out_path, 'streamlines.json')
    with open(streamlines_fname, 'w') as f:
        f.write(json.dumps(streamlines))

    params_fname = op.join(out_path, 'params.json')
    if params is None:
        with open(params_fname, 'w') as f:
            f.write(json.dumps({"analysis_params": {}, "scan_params": {}}))
    else:
        shutil.copy(params, params_fname)

    return nodes_fname, meta_fname, streamlines_fname, params_fname


def _create_subject_ids(n_subjects):
    if n_subjects > 1000:
        subject_ids = ['subject_%05d' % i for i in range(n_subjects)]
    elif n_subjects > 100:
        subject_ids = ['subject_%04d' % i for i in range(n_subjects)]
    elif n_subjects > 10:
        subject_ids = ['subject_%03d' % i for i in range(n_subjects)]
    else:
        subject_ids = ['subject_%02d' % i for i in range(n_subjects)]
    return subject_ids


def afq_mat2tables(mat_file_name, subject_ids=None, stats=None,
                   out_path=None, metadata=None):
    """
    Create nodes table, subjects table and params dict from AFQ `.mat` file.

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
        Full path for the CSV/JSON files to be saved as output. Default: pwd.

    metadata : str, optional
        Full path to a file with user-supplied metadata. This has to be a csv
        file with column headers in the first row, including a column named
        "subjectID". For an example, see the 'data/subjects.csv' that comes
        with the software. Defaults to use the metadata stored in the afq
        mat file. If no metadata provided and there is no meadata in the afq
        mat file, create a minimal metadata table.

    Returns
    -------
    tuple: paths to the files that get generated:
        nodes_fname, meta_fname, streamlines_fname, params_fname
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
    shape = vals[stats[0]].item()[0].shape
    if len(shape) > 1:
        n_subjects, nodes_per_tract = shape
    else:
        n_subjects = 1
        nodes_per_tract = shape[0]

    # Check if subject ids is defined in the afq structure
    if subject_ids is None:
        if 'sub_ids' in afq.dtype.names and len(afq['sub_ids'].item()):
            subject_ids = [str(x) for x in afq['sub_ids'].item()]
        else:
            subject_ids = _create_subject_ids(n_subjects)

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
                if n_subjects == 1:
                    scalar = vals[stat].item()[tract]
                else:
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
    # Next, the metadata:
    meta_fname = op.join(out_path, 'subjects.csv')

    if metadata is None:
        if 'metadata' in afq.dtype.names:
            try:
                # Create metadata from the AFQ struct:
                metadata = afq['metadata'].item()

                meta_df1 = pd.DataFrame({"subjectID": subject_ids},
                                        index=range(len(subject_ids)))
                # Metadata has mixed types, and we want to preserve that
                # going into the DataFrame. Hence, we go through a dict:
                metadata_for_df = {k: v for k, v in
                                   zip(metadata.dtype.names, metadata.item())}

                meta_df2 = pd.DataFrame(metadata_for_df)

                meta_df = pd.concat([meta_df1, meta_df2], axis=1)
                meta_df.to_csv(meta_fname)
            except ValueError:
                # If we're here, that's because the metadata in the AFQ mat
                # Doesn't have the right shape or has some other
                # wonky behavior:
                _create_metadata(subject_ids, meta_fname)
        else:
            # If we're here, that's because there probably is no metadata
            # In the AFQ mat file:
            _create_metadata(subject_ids, meta_fname)
    else:
        shutil.copy(metadata, meta_fname)

    # using default streamline file
    streamlines_fname = op.join(out_path, 'streamlines.json')

    params_fname = op.join(out_path, 'params.json')
    params = _extract_params(afq)
    json.dump(params, open(params_fname, 'w'))

    return nodes_fname, meta_fname, streamlines_fname, params_fname


def copy_and_overwrite(from_path, to_path):
    """Helper function: copies and overwrites."""
    if op.exists(to_path):
        shutil.rmtree(to_path)
    shutil.copytree(from_path, to_path)


def update_settings_json(settings_path, title=None, subtitle=None,
                         link=None, sublink=None):
    """Update settings.json with user supplied values

    settings_path : str
    Path to the settings.json file to be updated

    title : str, optional.
    Custom page title. Default: None.

    subtitle : str, optional.
    Custom page subtitle. Default: None.

    link : str, optional.
    Custom href for page title. Default: None.

    sublink : str, optional.
    Custom href for page subtitle. Default: None.
    """
    # Load the settings.json
    with open(settings_path) as fp:
        settings = json.load(fp)

    # Populate defaults from settings.json if they exist,
    # otherwise set to empty
    defaults = {}
    if settings.get('global') and settings.get('global').get('html'):
        html_settings = settings.get('global').get('html')
    else:
        html_settings = {}

    defaults['title'] = ('Page title', html_settings.get('title'))
    defaults['subtitle'] = ('Page subtitle', html_settings.get('subtitle'))
    defaults['link'] = ('Title hyperlink (including http(s)://)',
                        html_settings.get('link'))
    defaults['sublink'] = ('Subtitle hyperlink (including http(s)://)',
                           html_settings.get('sublink'))

    # python 2 compatible user input
    try:
        prompt = raw_input
    except NameError:
        prompt = input

    # Later, we'll iterate over key_list to get user input. But we don't
    # want to ask for user input if it's supplied as an argument to this
    # function, so if args are provided, use them as defaults, otherwise
    # append to key_list
    key_list = []
    if title is not None:
        html_settings['title'] = title
    else:
        key_list.append('title')

    if subtitle is not None:
        html_settings['subtitle'] = subtitle
    else:
        key_list.append('subtitle')

    if link is not None:
        html_settings['link'] = link
    else:
        key_list.append('link')

    if sublink is not None:
        html_settings['sublink'] = sublink
    else:
        key_list.append('sublink')

    # Prompt for input
    for key in key_list:
        prompt_text, value = defaults[key]
        text = '{p:s} [{d!s}]: '.format(p=prompt_text, d=value)
        new_val = prompt(text)
        if not new_val:
            new_val = value

        if new_val is not None:
            html_settings[key] = new_val

    # Update the settings.json dict
    html_settings = {'global': {'html': html_settings}}
    settings.update(html_settings)

    # Write to file
    with open(settings_path, 'w') as fp:
        json.dump(settings, fp)


def assemble(source, target=None, metadata=None, streamlines=None,
             title=None, subtitle=None,
             link=None, sublink=None):
    """
    Spin up an instance of the AFQ-Browser with data provided as a mat file.

    Parameters
    ----------
    source : str
        Path to a AFQ-Browser nodes csv-file, mat-file containing the AFQ
        data structure, or to a TRACULA stats folder.

    target : str, optional.
        Path to a file-system location to create this instance of the
        browser in. Default: pwd.

    metadata : str, optional.
        Path to an input csv metadata file. This file requires a "subjectID"
        column to work. If a file is provided, it will overwrite metadata
        provided through other. Default: read metadata from AFQ struct, or
        generate a metadata table with just a "subjectID" column (e.g., for
        TRACULA).

    streamlines : str, optional.
        Path to a user-supplied streamline JSON file. The file contains a
        description of tract trajectories in the 3D space of the anatomy.
        Within each tract, "coreFiber" is a required key, and subsequent
        numerical keys are not required.

    title : str, optional.
        Custom page title. Default: None.

    subtitle : str, optional.
        Custom page subtitle. Default: None.

    link : str, optional.
        Custom href for page title. Default: None.

    sublink : str, optional.
        Custom href for page subtitle. Default: None.
    """
    if target is None:
        target = '.'
    site_dir = op.join(target, 'AFQ-browser')
    # This is where the template is stored:
    data_path = op.join(afqb.__path__[0], 'site')
    copy_and_overwrite(data_path, site_dir)
    out_path = op.join(site_dir, 'client', 'data')

    settings_path = op.join(site_dir, 'client', 'settings.json')
    update_settings_json(settings_path, title, subtitle, link, sublink)

    if op.isdir(source):
        # Assume we got a TRACULA stats path:
        nodes_fname, meta_fname, streamlines_fname, params_fname =\
            tracula2nodes(source, out_path=out_path, metadata=metadata)

    else:
        ext = os.path.splitext(source)[-1].lower()

        if ext == '.mat':
            # We have an AFQ-generated mat-file on our hands:
            nodes_fname, meta_fname, streamlines_fname, params_fname =\
                afq_mat2tables(source, out_path=out_path, metadata=metadata)
        elif ext == '.csv':
            # We have an nodes.csv file
            nodes_fname, meta_fname, streamlines_fname =\
                _copy_nodes_table(source, out_path=out_path,
                                  metadata=metadata, streamlines=streamlines)
        else:
            raise ValueError(
                'Unknown source argument must be on of: '
                'TRACULA directory, AFQ mat file, or nodes csv file')

    validation_errors = _validate(nodes_fname, meta_fname, streamlines_fname)

    if validation_errors:
        raise ValueError(validation_errors)


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
