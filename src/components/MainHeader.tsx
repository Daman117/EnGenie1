import { ReactNode } from "react";

interface MainHeaderProps {
    children?: ReactNode;
    rightContent?: ReactNode;
    centerContent?: ReactNode;
}

export const MainHeader = ({ children, rightContent, centerContent }: MainHeaderProps) => {
    return (
        <header className="glass-header px-6 py-4 fixed top-0 w-full z-50">
            <div className="flex items-center justify-between">
                {/* Left side - Logo and Dynamic Content */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white/50">
                        <video
                            src="/animation.mp4"
                            autoPlay
                            muted
                            playsInline
                            disablePictureInPicture
                            controls={false}
                            onContextMenu={(e) => e.preventDefault()}
                            onError={(e) => {
                                const video = e.currentTarget;
                                video.load();
                                video.play().catch(() => { });
                            }}
                            className="w-full h-full object-cover pointer-events-none"
                        />
                    </div>

                    {/* Dynamic Content (Tabs/Breadcrumbs/Screen Names) */}
                    {children && (
                        <div className="max-w-[calc(100vw-330px)] min-w-0">
                            {children}
                        </div>
                    )}
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center gap-2 relative z-50">
                    {rightContent}
                </div>

                {/* Centered Content */}
                {centerContent && (
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <div className="pointer-events-auto">
                            {centerContent}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};
