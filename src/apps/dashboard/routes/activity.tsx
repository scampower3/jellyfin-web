import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActivityLogEntry } from '@jellyfin/sdk/lib/generated-client/models/activity-log-entry';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import PermMedia from '@mui/icons-material/PermMedia';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Link, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import UserAvatar from 'components/UserAvatar';
import { useLogEntires } from 'hooks/useLogEntries';
import { useUsers } from 'hooks/useUsers';
import { parseISO8601Date, toLocaleDateString, toLocaleTimeString } from 'scripts/datetime';
import globalize from 'lib/globalize';
import { toBoolean } from 'utils/string';

import LogLevelChip from '../components/activityTable/LogLevelChip';
import OverviewCell from '../components/activityTable/OverviewCell';
import GridActionsCellLink from '../components/dataGrid/GridActionsCellLink';

const DEFAULT_PAGE_SIZE = 25;
const VIEW_PARAM = 'useractivity';

const enum ActivityView {
    All,
    User,
    System
}

const getActivityView = (param: string | null) => {
    if (param === null) return ActivityView.All;
    if (toBoolean(param)) return ActivityView.User;
    return ActivityView.System;
};

const getRowId = (row: ActivityLogEntry) => row.Id ?? -1;

const Activity = () => {
    const [ searchParams, setSearchParams ] = useSearchParams();

    const [ activityView, setActivityView ] = useState(
        getActivityView(searchParams.get(VIEW_PARAM)));

    const [ paginationModel, setPaginationModel ] = useState({
        page: 0,
        pageSize: DEFAULT_PAGE_SIZE
    });

    const { data: usersData, isLoading: isUsersLoading } = useUsers();

    type UsersRecords = Record<string, UserDto>;
    const users: UsersRecords = useMemo(() => {
        if (!usersData) return {};

        return usersData.reduce<UsersRecords>((acc, user) => {
            const userId = user.Id;
            if (!userId) return acc;

            return {
                ...acc,
                [userId]: user
            };
        }, {});
    }, [usersData]);

    const activityParams = useMemo(() => ({
        startIndex: paginationModel.page * paginationModel.pageSize,
        limit: paginationModel.pageSize,
        hasUserId: activityView !== ActivityView.All ? activityView === ActivityView.User : undefined
    }), [activityView, paginationModel.page, paginationModel.pageSize]);

    const { data: logEntries, isLoading: isLogEntriesLoading } = useLogEntires(activityParams);

    const isLoading = isUsersLoading || isLogEntriesLoading;

    const userColDef: GridColDef[] = activityView !== ActivityView.System ? [
        {
            field: 'User',
            headerName: globalize.translate('LabelUser'),
            width: 60,
            valueGetter: ( value, row ) => users[row.UserId]?.Name,
            renderCell: ({ row }) => (
                <IconButton
                    size='large'
                    color='inherit'
                    sx={{ padding: 0 }}
                    title={users[row.UserId]?.Name ?? undefined}
                    component={Link}
                    to={`/dashboard/users/profile?userId=${row.UserId}`}
                >
                    <UserAvatar user={users[row.UserId]} />
                </IconButton>
            )
        }
    ] : [];

    const columns: GridColDef[] = [
        {
            field: 'Date',
            headerName: globalize.translate('LabelDate'),
            width: 90,
            type: 'date',
            valueGetter: ( value ) => parseISO8601Date(value),
            valueFormatter: ( value ) => toLocaleDateString(value)
        },
        {
            field: 'Time',
            headerName: globalize.translate('LabelTime'),
            width: 100,
            type: 'dateTime',
            valueGetter: ( value, row ) => parseISO8601Date(row.Date),
            valueFormatter: ( value ) => toLocaleTimeString(value)
        },
        {
            field: 'Severity',
            headerName: globalize.translate('LabelLevel'),
            width: 110,
            renderCell: ({ value }) => (
                value ? (
                    <LogLevelChip level={value} />
                ) : undefined
            )
        },
        ...userColDef,
        {
            field: 'Name',
            headerName: globalize.translate('LabelName'),
            width: 300
        },
        {
            field: 'Overview',
            headerName: globalize.translate('LabelOverview'),
            width: 200,
            valueGetter: ( value, row ) => row.ShortOverview ?? row.Overview,
            renderCell: ({ row }) => (
                <OverviewCell {...row} />
            )
        },
        {
            field: 'Type',
            headerName: globalize.translate('LabelType'),
            width: 180
        },
        {
            field: 'actions',
            type: 'actions',
            width: 50,
            getActions: ({ row }) => {
                const actions = [];

                if (row.ItemId) {
                    actions.push(
                        <GridActionsCellLink
                            size='large'
                            icon={<PermMedia />}
                            label={globalize.translate('LabelMediaDetails')}
                            title={globalize.translate('LabelMediaDetails')}
                            to={`/details?id=${row.ItemId}`}
                        />
                    );
                }

                return actions;
            }
        }
    ];

    const onViewChange = useCallback((_e: React.MouseEvent<HTMLElement, MouseEvent>, newView: ActivityView | null) => {
        if (newView !== null) {
            setActivityView(newView);
        }
    }, []);

    useEffect(() => {
        const currentViewParam = getActivityView(searchParams.get(VIEW_PARAM));
        if (currentViewParam !== activityView) {
            if (activityView === ActivityView.All) {
                searchParams.delete(VIEW_PARAM);
            } else {
                searchParams.set(VIEW_PARAM, `${activityView === ActivityView.User}`);
            }
            setSearchParams(searchParams);
        }
    }, [ activityView, searchParams, setSearchParams ]);

    return (
        <Page
            id='serverActivityPage'
            title={globalize.translate('HeaderActivity')}
            className='mainAnimatedPage type-interior'
        >
            <Box
                className='content-primary'
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'baseline',
                        marginY: 2
                    }}
                >
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant='h2'>
                            {globalize.translate('HeaderActivity')}
                        </Typography>
                    </Box>
                    <ToggleButtonGroup
                        value={activityView}
                        onChange={onViewChange}
                        exclusive
                    >
                        <ToggleButton value={ActivityView.All}>
                            {globalize.translate('All')}
                        </ToggleButton>
                        <ToggleButton value={ActivityView.User}>
                            {globalize.translate('LabelUser')}
                        </ToggleButton>
                        <ToggleButton value={ActivityView.System}>
                            {globalize.translate('LabelSystem')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
                <DataGrid
                    columns={columns}
                    rows={logEntries?.Items || []}
                    pageSizeOptions={[ 10, 25, 50, 100 ]}
                    paginationMode='server'
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    rowCount={logEntries?.TotalRecordCount || 0}
                    getRowId={getRowId}
                    loading={isLoading}
                />
            </Box>
        </Page>
    );
};

export default Activity;
